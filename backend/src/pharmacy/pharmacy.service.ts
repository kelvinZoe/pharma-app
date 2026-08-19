import { Injectable, BadRequestException, ConflictException, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';
import { NotificationsService } from '../notifications/notifications.service';
import * as crypto from 'crypto';
import { PharmacyPayablesService } from './pharmacy-payables.service';
import { buildDateRange } from '../common/date-range';

@Injectable()
export class PharmacyService {
  private readonly logger = new Logger(PharmacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly payablesService: PharmacyPayablesService,
  ) {}

  async findAllMedicines(locationId: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } });
    if (!location) throw new NotFoundException('Pharmacy location not found');
    return this.prisma.pharmacyMedicine.findMany({
      where: { tenantId: location.tenantId },
      include: {
        products: {
          include: { locationProducts: { where: { locationId }, take: 1 } },
          orderBy: { name: 'asc' },
          take: 50,
        },
      },
      orderBy: [{ genericName: 'asc' }, { strengthDisplay: 'asc' }],
      take: 500,
    });
  }

  async createMedicine(data: any, locationId: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } });
    if (!location) throw new NotFoundException('Pharmacy location not found');
    const normalized = this.normalizeMedicineInput(data);
    return this.prisma.pharmacyMedicine.create({
      data: { tenantId: location.tenantId, ...normalized },
    });
  }

  async updateMedicine(medicineId: string, data: any, locationId: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } });
    if (!location) throw new NotFoundException('Pharmacy location not found');
    const medicine = await this.prisma.pharmacyMedicine.findFirst({ where: { id: medicineId, tenantId: location.tenantId } });
    if (!medicine) throw new NotFoundException('Medicine definition not found');
    const normalized = this.normalizeMedicineInput({ ...medicine, ...data });
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pharmacyMedicine.update({ where: { id: medicineId }, data: normalized });
      const products = await tx.pharmacyProduct.findMany({ where: { medicineId } });
      for (const product of products) {
        const generatedName = this.buildProductName(updated, product);
        await tx.pharmacyProduct.update({
          where: { id: product.id },
          data: {
            name: generatedName,
            genericName: updated.genericName,
            strength: updated.strengthDisplay,
            dosageForm: updated.dosageForm,
            routeOfAdministration: updated.routeOfAdministration,
            therapeuticClass: updated.therapeuticClass,
            prescriptionRequired: updated.prescriptionCategory === 'POM',
          },
        });
      }
      return updated;
    });
  }

  // --- Products ---
  async findAllProducts(locationId: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } });
    if (!location) throw new NotFoundException('Pharmacy location not found');
    const products = await this.prisma.pharmacyProduct.findMany({
      where: { tenantId: location.tenantId },
      include: {
        medicine: true,
        batches: {
          where: { locationId },
          orderBy: { expiryDate: 'asc' },
          take: 50,
        },
        locationProducts: {
          where: { locationId },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });

    // Compute stock totals dynamically
    return products.map((p) => {
      const stockOnHand = p.batches.reduce((sum, b) => sum + b.quantityRemaining, 0);
      const availableStock = p.batches.reduce((sum, batch) => sum + Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityReserved ?? 0) - Number(batch.quantityQuarantined ?? 0)), 0);
      const locationProduct = p.locationProducts[0];
      const currentSellingPrice = locationProduct?.defaultSellingPrice ?? p.batches[0]?.sellingPrice ?? null;
      return {
        ...p,
        batches: p.batches.map((batch) => ({ ...batch, sellingPrice: currentSellingPrice ?? batch.sellingPrice, availableQuantity: Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityReserved ?? 0) - Number(batch.quantityQuarantined ?? 0)) })),
        locationProducts: undefined,
        reorderLevel: locationProduct?.reorderLevel ?? p.reorderLevel,
        shelfLocation: locationProduct?.shelfLocation ?? null,
        defaultSellingPrice: currentSellingPrice,
        isLocationActive: locationProduct?.isActive ?? p.isActive,
        isAvailableForSale: locationProduct?.isAvailableForSale ?? true,
        allowLooseSale: locationProduct?.allowLooseSale ?? p.allowLooseSale,
        minimumSaleQuantity: locationProduct?.minimumSaleQuantity ?? p.minimumSaleQuantity,
        unitsPerPurchaseUnit: p.packageQuantity ?? p.defaultUnitsPerPack,
        genericName: p.medicine?.genericName ?? p.genericName,
        strength: p.medicine?.strengthDisplay ?? p.strength,
        dosageForm: p.medicine?.dosageForm ?? p.dosageForm,
        stockOnHand,
        availableStock,
      };
    });
  }

  async findProductDetail(productId: string, locationId: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } });
    if (!location) throw new NotFoundException('Pharmacy location not found');
    const product = await this.prisma.pharmacyProduct.findFirst({
      where: { id: productId, tenantId: location.tenantId },
      include: {
        medicine: true,
        batches: {
          where: { locationId },
          orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
        },
        locationProducts: {
          where: { locationId },
          take: 1,
        },
        stockMovements: {
          where: { locationId },
          include: {
            batch: { select: { batchNumber: true } },
            createdByUser: { select: { fullName: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    });
    if (!product) throw new NotFoundException('Pharmacy product not found');

    const now = getInternetDate();
    const nearExpiryDate = new Date(now);
    nearExpiryDate.setDate(nearExpiryDate.getDate() + 90);
    const locationProduct = product.locationProducts[0];
    const currentSellingPrice = locationProduct?.defaultSellingPrice ?? product.batches[0]?.sellingPrice ?? null;
    const activeBatches = product.batches.filter((batch) => batch.quantityRemaining > 0 && batch.expiryDate >= now);
    const stockOnHand = product.batches.reduce((sum, batch) => sum + Number(batch.quantityRemaining), 0);
    const availableStock = activeBatches.reduce((sum, batch) => sum + Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityReserved ?? 0) - Number(batch.quantityQuarantined ?? 0)), 0);
    const expiredStock = product.batches
      .filter((batch) => batch.quantityRemaining > 0 && batch.expiryDate < now)
      .reduce((sum, batch) => sum + Number(batch.quantityRemaining), 0);
    const stockValue = activeBatches.reduce((sum, batch) => sum + Number(batch.quantityRemaining) * Number(batch.purchasePrice), 0);
    const averageCost = availableStock > 0 ? stockValue / availableStock : 0;
    const reorderLevel = locationProduct?.reorderLevel ?? product.reorderLevel;
    const nearestExpiry = activeBatches[0]?.expiryDate ?? null;
    const nearExpiryBatchCount = activeBatches.filter((batch) => batch.expiryDate <= nearExpiryDate).length;
    const latestPurchasedBatch = [...product.batches].sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime())[0];

    return {
      ...product,
      batches: product.batches.map((batch) => ({ ...batch, sellingPrice: currentSellingPrice ?? batch.sellingPrice, availableQuantity: Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityReserved ?? 0) - Number(batch.quantityQuarantined ?? 0)) })),
      locationProducts: undefined,
      reorderLevel,
      shelfLocation: locationProduct?.shelfLocation ?? null,
      defaultSellingPrice: currentSellingPrice,
      isLocationActive: locationProduct?.isActive ?? product.isActive,
      isAvailableForSale: locationProduct?.isAvailableForSale ?? true,
      allowLooseSale: locationProduct?.allowLooseSale ?? product.allowLooseSale,
      minimumSaleQuantity: locationProduct?.minimumSaleQuantity ?? product.minimumSaleQuantity,
      unitsPerPurchaseUnit: product.packageQuantity ?? product.defaultUnitsPerPack,
      genericName: product.medicine?.genericName ?? product.genericName,
      strength: product.medicine?.strengthDisplay ?? product.strength,
      dosageForm: product.medicine?.dosageForm ?? product.dosageForm,
      metrics: {
        stockOnHand,
        availableStock,
        expiredStock,
        stockValue,
        averageCost,
        lastPurchaseCost: latestPurchasedBatch ? Number(latestPurchasedBatch.purchasePrice) : null,
        nearestExpiry,
        activeBatchCount: activeBatches.length,
        nearExpiryBatchCount,
        isLowStock: availableStock <= reorderLevel,
        isOutOfStock: availableStock <= 0,
      },
    };
  }

  async createProduct(data: any, locationId: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } });
    if (!location) throw new NotFoundException('Pharmacy location not found');

    const medicine = data.medicineId
      ? await this.prisma.pharmacyMedicine.findFirst({ where: { id: String(data.medicineId), tenantId: location.tenantId } })
      : null;
    if (data.medicineId && !medicine) throw new NotFoundException('Medicine definition not found');

    const packageType = this.normalizeOptionalChoice(data.packageType ?? data.defaultPurchaseUnit, 'unit');
    const sellingUnit = this.normalizeOptionalChoice(data.sellingUnit ?? data.unitOfMeasure, 'unit');
    const unitsPerPurchaseUnit = this.normalizeUnitsPerPack(data.unitsPerPurchaseUnit ?? data.packageQuantity ?? data.defaultUnitsPerPack);
    const productName = data.name ? String(data.name).trim() : medicine ? this.buildProductName(medicine, { ...data, packageType, packageQuantity: unitsPerPurchaseUnit, packageUnit: data.packageUnit ?? sellingUnit, sellingUnit }) : '';
    if (!productName || !sellingUnit) throw new BadRequestException('Medicine and selling unit are required');

    const productCode = data.productCode ? String(data.productCode).trim().toUpperCase() : await this.generateProductCode(location.tenantId);
    const reorderLevel = data.reorderLevel !== undefined ? Number(data.reorderLevel) : 10;
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) throw new BadRequestException('Reorder level must be zero or greater');
    const defaultSellingPrice = data.defaultSellingPrice !== undefined
      ? this.requirePositivePrice(data.defaultSellingPrice, 'Default selling price')
      : null;
    const lifecycleStatus = this.normalizeLifecycleStatus(data.lifecycleStatus);
    const productInput = {
      ...data,
      name: productName,
      genericName: medicine?.genericName ?? data.genericName,
      strength: medicine?.strengthDisplay ?? data.strength,
      dosageForm: medicine?.dosageForm ?? data.dosageForm,
      unitOfMeasure: sellingUnit,
      packageType,
      packageQuantity: unitsPerPurchaseUnit,
      packageUnit: data.packageUnit ?? sellingUnit,
      sellingUnit,
    };
    const catalogueIdentity = this.buildCatalogueIdentity(productInput);

    await this.assertCatalogueIdentityAvailable(location.tenantId, catalogueIdentity, productCode, data.barcode);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.pharmacyProduct.create({
        data: {
          tenantId: location.tenantId,
          medicineId: medicine?.id ?? null,
          name: productName,
          description: data.description ? String(data.description).trim() : null,
          genericName: medicine?.genericName ?? (data.genericName ? String(data.genericName).trim() : null),
          brandName: data.brandName ? String(data.brandName).trim() : null,
          strength: medicine?.strengthDisplay ?? (data.strength ? String(data.strength).trim() : null),
          dosageForm: medicine?.dosageForm ?? (data.dosageForm ? String(data.dosageForm).trim() : null),
          routeOfAdministration: medicine?.routeOfAdministration ?? (data.routeOfAdministration ? String(data.routeOfAdministration).trim() : null),
          therapeuticClass: medicine?.therapeuticClass ?? (data.therapeuticClass ? String(data.therapeuticClass).trim() : null),
          prescriptionRequired: medicine?.prescriptionCategory === 'POM' || data.prescriptionRequired === true,
          controlledClassification: this.normalizeOptionalChoice(data.controlledClassification, 'none'),
          taxCategory: this.normalizeOptionalChoice(data.taxCategory, 'standard'),
          isTaxExempt: data.isTaxExempt === true,
          storageInstructions: data.storageInstructions ? String(data.storageInstructions).trim() : null,
          lifecycleStatus,
          defaultPurchaseUnit: packageType,
          defaultUnitsPerPack: unitsPerPurchaseUnit,
          packageType,
          packageQuantity: unitsPerPurchaseUnit,
          packageUnit: this.normalizeOptionalChoice(data.packageUnit, sellingUnit),
          packageSizeValue: this.optionalPositiveNumber(data.packageSizeValue),
          packageSizeUnit: data.packageSizeUnit ? String(data.packageSizeUnit).trim() : null,
          sellingUnit,
          allowLooseSale: data.allowLooseSale === true,
          minimumSaleQuantity: this.normalizeMinimumSaleQuantity(data.minimumSaleQuantity),
          catalogueIdentity,
          manufacturer: data.manufacturer ? String(data.manufacturer).trim() : null,
          barcode: data.barcode ? String(data.barcode).trim() : null,
          productCode,
          unitOfMeasure: sellingUnit,
          reorderLevel,
          isActive: lifecycleStatus === 'active',
        },
      });

      await tx.pharmacyLocationProduct.create({
        data: {
          tenantId: location.tenantId,
          locationId,
          productId: product.id,
          reorderLevel,
          shelfLocation: data.shelfLocation ? String(data.shelfLocation).trim() : null,
          defaultSellingPrice,
          isAvailableForSale: data.isAvailableForSale !== false,
          allowLooseSale: data.branchAllowLooseSale === undefined ? null : data.branchAllowLooseSale === true,
          minimumSaleQuantity: data.branchMinimumSaleQuantity === undefined || data.branchMinimumSaleQuantity === null
            ? null
            : this.normalizeMinimumSaleQuantity(data.branchMinimumSaleQuantity),
          isActive: true,
        },
      });

      return product;
    });
  }

  async updateProduct(productId: string, data: any, locationId: string, userId: string) {
    const location = await this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } });
    if (!location) throw new NotFoundException('Pharmacy location not found');
    const product = await this.prisma.pharmacyProduct.findFirst({ where: { id: productId, tenantId: location.tenantId }, include: { medicine: true } });
    if (!product) throw new NotFoundException('Pharmacy product not found');
    const currentLocationProduct = await this.prisma.pharmacyLocationProduct.findUnique({
      where: { locationId_productId: { locationId, productId } },
    });
    const priceWasProvided = data.defaultSellingPrice !== undefined;
    const nextSellingPrice = priceWasProvided
      ? this.requirePositivePrice(data.defaultSellingPrice, 'Default selling price')
      : undefined;
    const currentSellingPrice = currentLocationProduct?.defaultSellingPrice === null || currentLocationProduct?.defaultSellingPrice === undefined
      ? null
      : Number(currentLocationProduct.defaultSellingPrice);
    const priceChanged = priceWasProvided && (currentSellingPrice === null || Math.abs(currentSellingPrice - Number(nextSellingPrice)) > 0.000001);
    const priceChangeReason = String(data.priceChangeReason ?? '').trim();
    if (priceChanged && currentSellingPrice !== null && priceChangeReason.length < 5) {
      throw new BadRequestException('A detailed reason is required when changing the shop selling price');
    }

    const productUpdate: any = {};
    for (const field of ['name', 'description', 'genericName', 'brandName', 'strength', 'dosageForm', 'routeOfAdministration', 'therapeuticClass', 'storageInstructions', 'manufacturer', 'barcode', 'unitOfMeasure', 'packageType', 'packageUnit', 'packageSizeUnit', 'sellingUnit']) {
      if (data[field] !== undefined) productUpdate[field] = data[field] ? String(data[field]).trim() : null;
    }
    if (data.medicineId !== undefined) {
      const medicine = await this.prisma.pharmacyMedicine.findFirst({ where: { id: String(data.medicineId), tenantId: product.tenantId! } });
      if (!medicine) throw new NotFoundException('Medicine definition not found');
      productUpdate.medicineId = medicine.id;
      productUpdate.genericName = medicine.genericName;
      productUpdate.strength = medicine.strengthDisplay;
      productUpdate.dosageForm = medicine.dosageForm;
      productUpdate.routeOfAdministration = medicine.routeOfAdministration;
      productUpdate.therapeuticClass = medicine.therapeuticClass;
      productUpdate.prescriptionRequired = medicine.prescriptionCategory === 'POM';
    }
    if (data.productCode !== undefined && String(data.productCode).trim()) {
      productUpdate.productCode = String(data.productCode).trim().toUpperCase();
    }
    for (const field of ['controlledClassification', 'taxCategory']) {
      if (data[field] !== undefined) productUpdate[field] = this.normalizeOptionalChoice(data[field], field === 'taxCategory' ? 'standard' : 'none');
    }
    for (const field of ['prescriptionRequired', 'isTaxExempt', 'allowLooseSale']) {
      if (data[field] !== undefined) productUpdate[field] = data[field] === true;
    }
    if (data.defaultPurchaseUnit !== undefined) {
      productUpdate.defaultPurchaseUnit = data.defaultPurchaseUnit ? String(data.defaultPurchaseUnit).trim().toLowerCase() : null;
    }
    if (data.defaultUnitsPerPack !== undefined) productUpdate.defaultUnitsPerPack = this.normalizeUnitsPerPack(data.defaultUnitsPerPack);
    if (data.unitsPerPurchaseUnit !== undefined || data.packageQuantity !== undefined) {
      const units = this.normalizeUnitsPerPack(data.unitsPerPurchaseUnit ?? data.packageQuantity);
      productUpdate.packageQuantity = units;
      productUpdate.defaultUnitsPerPack = units;
    }
    if (data.packageType !== undefined) productUpdate.defaultPurchaseUnit = this.normalizeOptionalChoice(data.packageType, 'unit');
    if (data.sellingUnit !== undefined) productUpdate.unitOfMeasure = this.normalizeOptionalChoice(data.sellingUnit, 'unit');
    if (data.packageSizeValue !== undefined) productUpdate.packageSizeValue = this.optionalPositiveNumber(data.packageSizeValue);
    if (data.minimumSaleQuantity !== undefined) productUpdate.minimumSaleQuantity = this.normalizeMinimumSaleQuantity(data.minimumSaleQuantity);

    const lifecycleStatus = data.lifecycleStatus !== undefined
      ? this.normalizeLifecycleStatus(data.lifecycleStatus)
      : product.lifecycleStatus;
    productUpdate.lifecycleStatus = lifecycleStatus;
    productUpdate.isActive = lifecycleStatus === 'active';

    const linkedMedicine = productUpdate.medicineId
      ? await this.prisma.pharmacyMedicine.findUnique({ where: { id: productUpdate.medicineId } })
      : product.medicine;
    if (linkedMedicine && data.name === undefined) productUpdate.name = this.buildProductName(linkedMedicine, { ...product, ...productUpdate });
    const identitySource = { ...product, ...productUpdate };
    productUpdate.catalogueIdentity = this.buildCatalogueIdentity(identitySource);
    await this.assertCatalogueIdentityAvailable(product.tenantId!, productUpdate.catalogueIdentity, productUpdate.productCode ?? product.productCode, productUpdate.barcode ?? product.barcode, productId);

    return this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.pharmacyProduct.update({ where: { id: productId }, data: productUpdate });
      await tx.pharmacyLocationProduct.upsert({
        where: { locationId_productId: { locationId, productId } },
        create: {
          tenantId: product.tenantId!,
          locationId,
          productId,
          reorderLevel: Number(data.reorderLevel ?? product.reorderLevel),
          shelfLocation: data.shelfLocation ? String(data.shelfLocation).trim() : null,
          defaultSellingPrice: nextSellingPrice ?? null,
          isActive: data.isLocationActive !== undefined ? Boolean(data.isLocationActive) : true,
          isAvailableForSale: data.isAvailableForSale !== false,
          allowLooseSale: data.branchAllowLooseSale === undefined ? null : data.branchAllowLooseSale === true,
          minimumSaleQuantity: data.branchMinimumSaleQuantity === undefined || data.branchMinimumSaleQuantity === null ? null : this.normalizeMinimumSaleQuantity(data.branchMinimumSaleQuantity),
        },
        update: {
          ...(data.reorderLevel !== undefined ? { reorderLevel: Number(data.reorderLevel) } : {}),
          ...(data.shelfLocation !== undefined ? { shelfLocation: data.shelfLocation ? String(data.shelfLocation).trim() : null } : {}),
          ...(priceWasProvided ? { defaultSellingPrice: nextSellingPrice } : {}),
          ...(data.isLocationActive !== undefined ? { isActive: Boolean(data.isLocationActive) } : {}),
          ...(data.isAvailableForSale !== undefined ? { isAvailableForSale: Boolean(data.isAvailableForSale) } : {}),
          ...(data.branchAllowLooseSale !== undefined ? { allowLooseSale: data.branchAllowLooseSale === null ? null : Boolean(data.branchAllowLooseSale) } : {}),
          ...(data.branchMinimumSaleQuantity !== undefined ? { minimumSaleQuantity: data.branchMinimumSaleQuantity === null ? null : this.normalizeMinimumSaleQuantity(data.branchMinimumSaleQuantity) } : {}),
        },
      });
      if (priceChanged) {
        await tx.pharmacyBatch.updateMany({
          where: { locationId, productId },
          data: { sellingPrice: Number(nextSellingPrice) },
        });
        await tx.auditLog.create({
          data: {
            actionType: 'price_change',
            entityType: 'pharmacy_location_product',
            entityId: currentLocationProduct?.id ?? productId,
            beforeData: JSON.stringify({ locationId, productId, sellingPrice: currentSellingPrice }),
            afterData: JSON.stringify({ locationId, productId, sellingPrice: nextSellingPrice, reason: priceChangeReason || 'Initial shop price' }),
            actorUserId: userId,
          },
        });
      }
      return updatedProduct;
    });
  }

  private normalizeMedicineInput(data: any) {
    const genericName = String(data.genericName ?? '').trim();
    const dosageForm = String(data.dosageForm ?? '').trim();
    const strengthUnit = String(data.strengthUnit ?? '').trim();
    const strengthValue = Number(data.strengthValue);
    if (!genericName || !dosageForm) throw new BadRequestException('Generic name and dosage form are required');
    if (!Number.isFinite(strengthValue) || strengthValue <= 0 || !strengthUnit) {
      throw new BadRequestException('A valid strength value and unit are required');
    }
    const strengthPerValue = data.strengthPerValue === null || data.strengthPerValue === undefined || data.strengthPerValue === ''
      ? null
      : Number(data.strengthPerValue);
    if (strengthPerValue !== null && (!Number.isFinite(strengthPerValue) || strengthPerValue <= 0)) {
      throw new BadRequestException('Strength per value must be greater than zero');
    }
    const strengthPerUnit = data.strengthPerUnit ? String(data.strengthPerUnit).trim() : null;
    const prescriptionCategory = String(data.prescriptionCategory ?? 'OTC').trim().toUpperCase();
    if (!['OTC', 'P', 'POM'].includes(prescriptionCategory)) {
      throw new BadRequestException('Prescription category must be OTC, P or POM');
    }
    const lifecycleStatus = this.normalizeLifecycleStatus(data.lifecycleStatus);
    const strengthDisplay = this.formatStrength(strengthValue, strengthUnit, strengthPerValue, strengthPerUnit);
    const catalogueIdentity = [genericName, dosageForm, strengthValue, strengthUnit, strengthPerValue ?? '', strengthPerUnit ?? '']
      .map((value) => String(value).normalize('NFKD').toLowerCase().replace(/[^a-z0-9.]/g, ''))
      .join('|');
    return {
      genericName,
      dosageForm,
      strengthValue,
      strengthUnit,
      strengthPerValue,
      strengthPerUnit,
      strengthDisplay,
      routeOfAdministration: data.routeOfAdministration ? String(data.routeOfAdministration).trim() : null,
      therapeuticClass: data.therapeuticClass ? String(data.therapeuticClass).trim() : null,
      prescriptionCategory,
      description: data.description ? String(data.description).trim() : null,
      lifecycleStatus,
      catalogueIdentity,
    };
  }

  private formatStrength(value: number, unit: string, perValue: number | null, perUnit: string | null): string {
    const amount = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
    if (unit === '%') return `${amount}%`;
    if (!perValue || !perUnit) return `${amount} ${unit}`;
    const per = Number.isInteger(perValue) ? String(perValue) : String(Number(perValue.toFixed(6)));
    return `${amount} ${unit} per ${per} ${perUnit}`;
  }

  private buildProductName(medicine: any, product: any): string {
    const identity = String(product.brandName || medicine.genericName).trim();
    const clinical = [medicine.strengthDisplay, medicine.dosageForm].filter(Boolean).join(' ');
    const packageType = String(product.packageType || product.defaultPurchaseUnit || 'unit').trim();
    const packageQuantity = Number(product.packageQuantity ?? product.defaultUnitsPerPack ?? 1);
    const packageUnit = String(product.packageUnit || product.sellingUnit || product.unitOfMeasure || 'unit').trim();
    const packageSize = product.packageSizeValue && product.packageSizeUnit
      ? `${Number(product.packageSizeValue)}${product.packageSizeUnit}`
      : packageQuantity > 1 ? `${packageType} of ${packageQuantity} ${packageUnit}${packageQuantity === 1 || packageUnit.endsWith('s') ? '' : 's'}` : packageType;
    return `${identity} ${clinical} — ${packageSize}`.replace(/\s+/g, ' ').trim();
  }

  private async generateProductCode(tenantId: string): Promise<string> {
    let sequence = await this.prisma.pharmacyProduct.count({ where: { tenantId } }) + 1;
    while (true) {
      const productCode = `MED-${String(sequence).padStart(6, '0')}`;
      const exists = await this.prisma.pharmacyProduct.findFirst({ where: { tenantId, productCode }, select: { id: true } });
      if (!exists) return productCode;
      sequence += 1;
    }
  }

  private optionalPositiveNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new BadRequestException('Package size must be greater than zero');
    return number;
  }

  private requirePositivePrice(value: unknown, label: string): number {
    const price = Number(value);
    if (!Number.isFinite(price) || price <= 0) {
      throw new BadRequestException(`${label} must be greater than zero`);
    }
    return Math.round((price + Number.EPSILON) * 100) / 100;
  }

  private normalizeMinimumSaleQuantity(value: unknown): number {
    const quantity = value === undefined || value === null || value === '' ? 1 : Number(value);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Minimum sale quantity must be greater than zero');
    return quantity;
  }

  private buildCatalogueIdentity(data: any): string {
    const primaryName = data.genericName || data.name;
    if (!primaryName || !data.unitOfMeasure) {
      throw new BadRequestException('Medicine name and dispensing unit are required to identify a catalogue item');
    }

    return [
      data.medicineId || primaryName,
      data.brandName || data.manufacturer || 'generic',
      data.strength || '',
      data.dosageForm || '',
      data.packageType || data.defaultPurchaseUnit || '',
      data.packageQuantity || data.defaultUnitsPerPack || 1,
      data.packageUnit || data.unitOfMeasure,
      data.packageSizeValue || '',
      data.packageSizeUnit || '',
      data.sellingUnit || data.unitOfMeasure,
    ].map((value) => String(value).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '')).join('|');
  }

  private normalizeLifecycleStatus(value: unknown): string {
    const status = String(value ?? 'active').trim().toLowerCase();
    if (!['active', 'archived', 'discontinued'].includes(status)) {
      throw new BadRequestException('Lifecycle status must be active, archived or discontinued');
    }
    return status;
  }

  private normalizeUnitsPerPack(value: unknown): number {
    const unitsPerPack = value === undefined || value === null || value === '' ? 1 : Number(value);
    if (!Number.isFinite(unitsPerPack) || unitsPerPack <= 0) {
      throw new BadRequestException('Default units per pack must be greater than zero');
    }
    return unitsPerPack;
  }

  private normalizeOptionalChoice(value: unknown, fallback: string): string {
    return String(value ?? fallback).trim().toLowerCase() || fallback;
  }

  private async assertCatalogueIdentityAvailable(
    tenantId: string,
    catalogueIdentity: string,
    productCode?: string | null,
    barcode?: string | null,
    excludedProductId?: string,
  ): Promise<void> {
    const normalizedCode = productCode ? String(productCode).trim().toUpperCase() : null;
    const normalizedBarcode = barcode ? String(barcode).trim() : null;
    const conflicts: any[] = [{ catalogueIdentity }];
    if (normalizedCode) conflicts.push({ productCode: normalizedCode });
    if (normalizedBarcode) conflicts.push({ barcode: normalizedBarcode });

    const existing = await this.prisma.pharmacyProduct.findFirst({
      where: {
        tenantId,
        ...(excludedProductId ? { id: { not: excludedProductId } } : {}),
        OR: conflicts,
      },
      select: { name: true, productCode: true, barcode: true, catalogueIdentity: true },
    });
    if (!existing) return;

    if (existing.catalogueIdentity === catalogueIdentity) {
      throw new ConflictException(`A matching medicine already exists in the catalogue: ${existing.name}`);
    }
    if (normalizedCode && existing.productCode === normalizedCode) {
      throw new ConflictException(`Product code ${normalizedCode} is already in use`);
    }
    throw new ConflictException(`Barcode ${normalizedBarcode} is already in use`);
  }

  // --- Batches & Intakes ---
  async addBatch(productId: string, data: any, userId: string, locationId: string) {
    void productId;
    void data;
    void userId;
    void locationId;
    throw new BadRequestException('Direct batch intake is disabled. Receive stock through a supplier goods receipt.');
  }

  async receiveStock(data: any, userId: string, locationId: string, isAdmin: boolean) {
    const lines = Array.isArray(data.lines) ? data.lines : [];
    if (lines.length === 0) throw new BadRequestException('At least one stock receipt line is required');

    const location = await this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } });
    if (!location) throw new NotFoundException('Pharmacy location not found');

    const supplierId = String(data.supplierId ?? '').trim();
    if (!supplierId) throw new BadRequestException('An active supplier is required for a goods receipt');
    const supplier = await this.prisma.pharmacySupplier.findFirst({ where: { id: supplierId, isActive: true } });
    if (!supplier) throw new BadRequestException('The selected supplier is inactive or unavailable');

    const purchaseOrderId = data.purchaseOrderId ? String(data.purchaseOrderId).trim() : null;
    const directReceiptReason = String(data.directReceiptReason ?? '').trim();
    if (!purchaseOrderId && !isAdmin) {
      throw new BadRequestException('An approved purchase order is required before receiving stock');
    }
    if (!purchaseOrderId && directReceiptReason.length < 10) {
      throw new BadRequestException('Admin direct receipts require a detailed override reason');
    }
    const purchaseOrder = purchaseOrderId
      ? await this.prisma.pharmacyPurchaseOrder.findFirst({ where: { id: purchaseOrderId, locationId }, include: { lines: true } })
      : null;
    if (purchaseOrderId && !purchaseOrder) throw new NotFoundException('Purchase order not found at the active pharmacy location');
    if (purchaseOrder && !['approved', 'partially_received'].includes(purchaseOrder.status)) {
      throw new ConflictException('Only approved or partially received purchase orders can receive stock');
    }
    if (purchaseOrder && purchaseOrder.supplierId !== supplier.id) {
      throw new BadRequestException('The selected supplier does not match the purchase order');
    }
    const purchaseOrderLines = new Map((purchaseOrder?.lines ?? []).map((line) => [line.id, line]));

    const normalizedLines = lines.map((line: any, index: number) => {
      const packQuantity = Number(line.packQuantity);
      const unitsPerPack = Number(line.unitsPerPack);
      const purchasePricePerPack = Number(line.purchasePricePerPack);
      const expiryDate = new Date(line.expiryDate);
      const batchNumber = String(line.batchNumber ?? '').trim().toUpperCase();
      const productId = String(line.productId ?? '').trim();
      const purchaseOrderLineId = line.purchaseOrderLineId ? String(line.purchaseOrderLineId).trim() : null;

      if (!productId || !batchNumber || Number.isNaN(expiryDate.getTime())) {
        throw new BadRequestException(`Line ${index + 1}: medicine, batch number and expiry date are required`);
      }
      if (expiryDate <= new Date()) throw new BadRequestException(`Line ${index + 1}: expired stock cannot be received`);
      if (!Number.isFinite(packQuantity) || !Number.isFinite(unitsPerPack) || packQuantity <= 0 || unitsPerPack <= 0) {
        throw new BadRequestException(`Line ${index + 1}: pack quantities must be greater than zero`);
      }
      if (!Number.isFinite(purchasePricePerPack) || purchasePricePerPack <= 0) {
        throw new BadRequestException(`Line ${index + 1}: purchase price must be greater than zero`);
      }

      const quantityReceived = packQuantity * unitsPerPack;
      if (purchaseOrder) {
        if (!purchaseOrderLineId) throw new BadRequestException(`Line ${index + 1}: purchase order line reference is required`);
        const orderLine = purchaseOrderLines.get(purchaseOrderLineId);
        if (!orderLine || orderLine.productId !== productId) throw new BadRequestException(`Line ${index + 1}: medicine does not match the purchase order`);
        const outstandingUnits = Number(orderLine.orderedUnits) - Number(orderLine.receivedUnits);
        if (quantityReceived > outstandingUnits + 0.000001) throw new BadRequestException(`Line ${index + 1}: received quantity exceeds the ${outstandingUnits} outstanding units`);
      }
      return {
        productId,
        purchaseOrderLineId,
        batchNumber,
        expiryDate,
        purchaseUnit: String(line.purchaseUnit ?? 'unit').trim() || 'unit',
        packQuantity,
        unitsPerPack,
        quantityReceived,
        purchasePricePerPack,
        unitCost: purchasePricePerPack / unitsPerPack,
        sellingPrice: 0,
        lineTotal: packQuantity * purchasePricePerPack,
      };
    });

    const duplicateKeys = new Set<string>();
    for (const line of normalizedLines) {
      const key = `${line.productId}:${line.batchNumber.toLowerCase()}`;
      if (duplicateKeys.has(key)) throw new BadRequestException(`Batch ${line.batchNumber} is duplicated in this receipt`);
      duplicateKeys.add(key);
    }

    for (const line of normalizedLines) {
      const existingBatch = await this.prisma.pharmacyBatch.findFirst({
        where: {
          locationId,
          productId: line.productId,
          batchNumber: line.batchNumber,
        },
        select: { id: true },
      });
      if (existingBatch) {
        throw new ConflictException(`Batch ${line.batchNumber} already exists for the selected medicine at this location`);
      }
    }

    const productIds = [...new Set<string>(normalizedLines.map((line: any) => String(line.productId)))];
    const products = await this.prisma.pharmacyProduct.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more selected medicines are unavailable');
    }
    const locationProducts = await this.prisma.pharmacyLocationProduct.findMany({
      where: { locationId, productId: { in: productIds }, isActive: true },
      select: { productId: true, defaultSellingPrice: true },
    });
    const currentPrices = new Map(locationProducts.map((policy) => [policy.productId, policy.defaultSellingPrice]));
    for (const line of normalizedLines) {
      const currentPrice = currentPrices.get(line.productId);
      if (currentPrice === null || currentPrice === undefined || !Number.isFinite(Number(currentPrice)) || Number(currentPrice) <= 0) {
        const product = products.find((candidate) => candidate.id === line.productId);
        throw new BadRequestException(`Set a valid shop selling price for ${product?.name ?? 'the selected medicine'} before receiving it`);
      }
      line.sellingPrice = Number(currentPrice);
    }

    const supplierInvoiceNumber = String(data.supplierInvoiceNumber ?? '').trim().toUpperCase() || null;
    if (supplierInvoiceNumber) {
      const duplicateInvoice = await this.prisma.pharmacySupplierInvoice.findFirst({
        where: { supplierId: supplier.id, supplierInvoiceNumber },
        select: { invoiceNumber: true },
      });
      if (duplicateInvoice) throw new ConflictException(`Supplier invoice ${supplierInvoiceNumber} has already been recorded`);
    }

    const totalCost = normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const receiptNumber = `GRN-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    try {
      return await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.pharmacyGoodsReceipt.create({
        data: {
          tenantId: location.tenantId,
          locationId,
          createdByUserId: userId,
          supplierId: supplier.id,
          purchaseOrderId,
          receiptNumber,
          supplierName: supplier.name,
          supplierInvoiceNumber,
          receivedAt: data.receivedAt ? new Date(data.receivedAt) : new Date(),
          notes: [data.notes ? String(data.notes).trim() : '', directReceiptReason ? `Direct receipt override: ${directReceiptReason}` : ''].filter(Boolean).join('\n') || null,
          totalCost,
          status: 'posted',
        },
      });

      for (const line of normalizedLines) {
        const batch = await tx.pharmacyBatch.create({
          data: {
            tenantId: location.tenantId,
            locationId,
            productId: line.productId,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate,
            purchasePrice: line.unitCost,
            sellingPrice: line.sellingPrice,
            quantityReceived: line.quantityReceived,
            quantityRemaining: line.quantityReceived,
          },
        });

        await tx.pharmacyGoodsReceiptLine.create({
          data: {
            tenantId: location.tenantId,
            locationId,
            receiptId: receipt.id,
            productId: line.productId,
            batchId: batch.id,
            purchaseOrderLineId: line.purchaseOrderLineId,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate,
            purchaseUnit: line.purchaseUnit,
            packQuantity: line.packQuantity,
            unitsPerPack: line.unitsPerPack,
            quantityReceived: line.quantityReceived,
            purchasePricePerPack: line.purchasePricePerPack,
            unitCost: line.unitCost,
            sellingPrice: line.sellingPrice,
            lineTotal: line.lineTotal,
          },
        });

        await tx.pharmacyLocationProduct.upsert({
          where: { locationId_productId: { locationId, productId: line.productId } },
          create: {
            tenantId: location.tenantId,
            locationId,
            productId: line.productId,
            reorderLevel: products.find((product) => product.id === line.productId)?.reorderLevel ?? 10,
            defaultSellingPrice: line.sellingPrice,
            isActive: true,
          },
          update: { isActive: true },
        });
        await tx.pharmacyBatch.updateMany({
          where: { locationId, productId: line.productId },
          data: { sellingPrice: line.sellingPrice },
        });

        await tx.pharmacyStockMovement.create({
          data: {
            tenantId: location.tenantId,
            locationId,
            productId: line.productId,
            batchId: batch.id,
            movementType: 'goods_receipt',
            quantity: line.quantityReceived,
            quantityBefore: 0,
            quantityAfter: line.quantityReceived,
            unitCost: line.unitCost,
            createdByUserId: userId,
            referenceId: receipt.id,
            referenceType: 'goods_receipt',
          },
        });

        if (purchaseOrderId && line.purchaseOrderLineId) {
          const updatedLines = await tx.$executeRaw`
            UPDATE "PharmacyPurchaseOrderLine"
            SET "receivedUnits" = "receivedUnits" + ${line.quantityReceived}, "updatedAt" = ${getInternetDate()}
            WHERE "id" = ${line.purchaseOrderLineId}
              AND "purchaseOrderId" = ${purchaseOrderId}
              AND "tenantId" = ${location.tenantId}
              AND "receivedUnits" + ${line.quantityReceived} <= "orderedUnits" + 0.000001
          `;
          if (updatedLines !== 1) throw new ConflictException(`Purchase order quantity changed while receiving ${line.batchNumber}. Reload and try again.`);
        }
      }

      if (purchaseOrderId) {
        const updatedOrderLines = await tx.pharmacyPurchaseOrderLine.findMany({ where: { purchaseOrderId } });
        const isFullyReceived = updatedOrderLines.every((line) => line.receivedUnits + 0.000001 >= line.orderedUnits);
        await tx.pharmacyPurchaseOrder.update({
          where: { id: purchaseOrderId },
          data: { status: isFullyReceived ? 'received' : 'partially_received' },
        });
      }

      const supplierInvoice = await this.payablesService.createInvoiceForReceipt(tx, receipt, supplier, {
        ...data,
        supplierInvoiceNumber,
      });

      await tx.auditLog.create({
        data: {
          actionType: 'post',
          entityType: 'pharmacy_goods_receipt',
          entityId: receipt.id,
          afterData: JSON.stringify({ receiptNumber, supplierId: supplier.id, supplierInvoiceId: supplierInvoice.id, purchaseOrderId, totalCost, directReceiptReason: directReceiptReason || null }),
          actorUserId: userId,
        },
      });

      return tx.pharmacyGoodsReceipt.findUnique({
        where: { id: receipt.id },
        include: { supplierInvoice: true, lines: { include: { product: true, batch: true } }, createdBy: { select: { fullName: true } } },
      });
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to post goods receipt ${receiptNumber}: ${error?.code ?? error?.name ?? 'Error'} - ${error?.message ?? 'Unknown error'}`,
        error?.stack,
      );
      if (error?.code === 'P2002') {
        throw new ConflictException('A batch number or receipt reference already exists. Refresh the inventory and check the delivery lines.');
      }
      if (error?.code === 'P2021' || error?.code === 'P2022') {
        throw new ServiceUnavailableException('The pharmacy receiving database migration is incomplete. Apply the latest pharmacy migrations and restart the backend.');
      }
      if (error?.code === 'P2028') {
        throw new ServiceUnavailableException('The database is temporarily busy and could not start the stock transaction. Please wait a moment and submit the receipt again.');
      }
      throw error;
    }
  }

  async listGoodsReceipts(locationId: string) {
    return this.prisma.pharmacyGoodsReceipt.findMany({
      where: { locationId },
      include: { supplier: true, supplierInvoice: true, purchaseOrder: { select: { id: true, orderNumber: true } }, lines: { include: { product: true } }, createdBy: { select: { fullName: true } } },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });
  }

  // --- Point of Sale (POS) Checkout ---
  async processSale(data: any, userId: string, locationId: string) {
    const { paymentMethod, items } = data;

    if (!paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Payment method and at least one item are required');
    }

    if (!['cash', 'mobile_money'].includes(paymentMethod)) {
      throw new BadRequestException('Payment method must be cash or mobile_money');
    }

    const referenceNumber = String(data.referenceNumber ?? data.transactionReference ?? '').trim().toUpperCase();
    if (paymentMethod === 'mobile_money' && !referenceNumber) {
      throw new BadRequestException('Mobile money reference is required');
    }
    const now = getInternetDate();
    const dateCode = now.toISOString().slice(0, 10).replaceAll('-', '');
    const saleNumber = `PH-${dateCode}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    let result: any;
    try {
      result = await this.prisma.$transaction(async (tx) => {
      // Check for active open session
      const activeSession = await tx.pharmacyDailyClosure.findFirst({
        where: {
          openedByUserId: userId,
          locationId,
          status: 'open',
        },
      });

      if (!activeSession) {
        throw new BadRequestException('No active register session. Please open the register first.');
      }
      const sessionTouch = await tx.pharmacyDailyClosure.updateMany({
        where: { id: activeSession.id, openedByUserId: userId, locationId, status: 'open' },
        data: { updatedAt: getInternetDate() },
      });
      if (sessionTouch.count !== 1) {
        throw new ConflictException('The register session is closing. Refresh before collecting payment.');
      }

      if (paymentMethod === 'mobile_money') {
        const duplicateReference = await tx.pharmacySale.findFirst({
          where: { locationId, paymentMethod: 'mobile_money', referenceNumber, status: { not: 'voided' } },
        });
        if (duplicateReference) {
          throw new ConflictException('This mobile money reference has already been used at this location');
        }
      }

      let subtotal = 0;
      const saleItemsToCreate: any[] = [];
      const productIdsSold = new Set<string>();

      for (const item of items) {
        const { productId, quantity } = item;

        if (!productId || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
          throw new BadRequestException('Invalid item fields or quantity');
        }

        const product = await tx.pharmacyProduct.findFirst({
          where: { id: productId, isActive: true },
          include: {
            locationProducts: { where: { locationId, isActive: true }, take: 1 },
            batches: {
              where: { locationId, expiryDate: { gt: now }, quantityRemaining: { gt: 0 } },
              orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
            },
          },
        });

        if (!product) {
          throw new NotFoundException('Medicine is inactive or unavailable');
        }

        const locationPrice = product.locationProducts[0]?.defaultSellingPrice;
        const locationPolicy = product.locationProducts[0];
        if (locationPolicy?.isAvailableForSale === false) {
          throw new BadRequestException(`${product.name} is not available for sale at this pharmacy`);
        }
        if (locationPrice === null || locationPrice === undefined || !Number.isFinite(Number(locationPrice)) || Number(locationPrice) <= 0) {
          throw new BadRequestException(`Set the current selling price for ${product.name} before selling it`);
        }

        const qtyToSell = Number(quantity);
        const allowLooseSale = locationPolicy?.allowLooseSale ?? product.allowLooseSale;
        const configuredMinimum = Math.max(1, Number(locationPolicy?.minimumSaleQuantity ?? product.minimumSaleQuantity ?? 1));
        const packageQuantity = Math.max(1, Number(product.packageQuantity ?? product.defaultUnitsPerPack ?? 1));
        const minimumSaleQuantity = allowLooseSale ? configuredMinimum : Math.max(configuredMinimum, packageQuantity);
        if (qtyToSell < minimumSaleQuantity) {
          throw new BadRequestException(`${product.name} must be sold in quantities of at least ${minimumSaleQuantity}`);
        }
        if (!allowLooseSale && Math.abs(qtyToSell / minimumSaleQuantity - Math.round(qtyToSell / minimumSaleQuantity)) > 0.000001) {
          throw new BadRequestException(`${product.name} must be sold in whole package quantities of ${minimumSaleQuantity}`);
        }
        const totalAvailable = product.batches.reduce(
          (sum, batch) => sum + Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityReserved ?? 0) - Number(batch.quantityQuarantined ?? 0)),
          0,
        );
        if (qtyToSell > totalAvailable + 0.000001) {
          throw new BadRequestException(
            `Insufficient available stock for ${product.name}. Requested: ${qtyToSell}, Available: ${totalAvailable}`,
          );
        }

        let quantityRemainingToAllocate = qtyToSell;
        productIdsSold.add(productId);
        for (const batch of product.batches) {
          if (quantityRemainingToAllocate <= 0.000001) break;
          const batchAvailable = Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityReserved ?? 0) - Number(batch.quantityQuarantined ?? 0));
          if (batchAvailable <= 0.000001) continue;
          const allocatedQuantity = Math.min(quantityRemainingToAllocate, batchAvailable);
          const quantityBefore = Number(batch.quantityRemaining);
          const deduction = await tx.pharmacyBatch.updateMany({
            where: {
              id: batch.id,
              productId,
              locationId,
              expiryDate: { gt: now },
              quantityRemaining: batch.quantityRemaining,
              quantityReserved: batch.quantityReserved,
              quantityQuarantined: batch.quantityQuarantined,
            },
            data: { quantityRemaining: { decrement: allocatedQuantity } },
          });
          if (deduction.count !== 1) {
            throw new ConflictException(`Stock changed for ${product.name}. Refresh the cart and try again.`);
          }
          await tx.pharmacyStockMovement.create({
            data: {
              productId,
              batchId: batch.id,
              movementType: 'sale',
              quantity: -allocatedQuantity,
              quantityBefore,
              quantityAfter: quantityBefore - allocatedQuantity,
              unitCost: batch.purchasePrice,
              createdByUserId: userId,
              locationId,
              referenceType: 'pharmacy_sale',
            },
          });
          const allocationTotal = Number(locationPrice) * allocatedQuantity;
          subtotal += allocationTotal;
          saleItemsToCreate.push({
            productId,
            batchId: batch.id,
            itemName: product.name,
            quantity: allocatedQuantity,
            unitPrice: locationPrice,
            unitCost: batch.purchasePrice,
            lineTotal: allocationTotal,
          });
          quantityRemainingToAllocate -= allocatedQuantity;
        }
      }

      // Create Sale header linked to session
      const sale = await tx.pharmacySale.create({
        data: {
          saleNumber,
          saleSource: 'walk_in',
          customerName: data.customerName ? String(data.customerName).trim() : null,
          visitId: null,
          prescriptionId: null,
          subtotal,
          total: subtotal,
          paymentMethod,
          referenceNumber: referenceNumber || null,
          status: 'paid',
          soldByUserId: userId,
          closureId: activeSession.id,
          locationId,
        },
      });

      // Create Sale Items linked to header
      for (const saleItem of saleItemsToCreate) {
        await tx.pharmacySaleItem.create({
          data: {
            saleId: sale.id,
            productId: saleItem.productId,
            batchId: saleItem.batchId,
            itemName: saleItem.itemName,
            quantity: saleItem.quantity,
            unitPrice: saleItem.unitPrice,
            unitCost: saleItem.unitCost,
            lineTotal: saleItem.lineTotal,
            locationId,
          },
        });
      }

      // Register AuditLog
      await tx.auditLog.create({
        data: {
          actionType: 'create',
          entityType: 'sale',
          entityId: sale.id,
          afterData: JSON.stringify({ saleNumber, total: subtotal }),
          actorUserId: userId,
        },
      });

      const lowStockAlerts: Array<{ id: string; name: string; stockOnHand: number; reorderLevel: number }> = [];
      for (const productId of productIdsSold) {
        const productWithBatches = await tx.pharmacyProduct.findUnique({
          where: { id: productId },
          include: { batches: { where: { locationId } } },
        });
        if (productWithBatches) {
          const stockOnHand = productWithBatches.batches.reduce((sum, batch) => sum + Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityReserved ?? 0) - Number(batch.quantityQuarantined ?? 0)), 0);
          const reorderLevel = Number(productWithBatches.reorderLevel);
          if (stockOnHand <= reorderLevel) {
            lowStockAlerts.push({
              id: productWithBatches.id,
              name: productWithBatches.name,
              stockOnHand,
              reorderLevel,
            });
          }
        }
      }

      const savedSale = await tx.pharmacySale.findFirst({
        where: { id: sale.id, locationId },
        include: {
          items: { include: { batch: { select: { batchNumber: true, expiryDate: true } } } },
          soldByUser: { select: { fullName: true, username: true } },
          location: { select: { code: true, name: true, address: true, phone: true } },
          prescription: { include: { visit: { include: { patient: true } } } },
        },
      });

      if (!savedSale) {
        throw new ServiceUnavailableException('The sale was created but its receipt could not be prepared. Please retry.');
      }

        return { sale: savedSale, lowStockAlerts };
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('This sale or mobile money reference has already been recorded');
      }
      throw error;
    }

    for (const item of result.lowStockAlerts) {
      await this.notificationsService.create({
        title: 'Low stock alert',
        message: `${item.name} is at ${item.stockOnHand} units, below or equal to reorder level ${item.reorderLevel}.`,
        type: 'warning',
        module: 'pharmacy',
        targetRoles: [0, 4],
        entityType: 'pharmacyProduct',
        entityId: item.id,
        route: '/pharmacy/inventory',
      });
    }

    return result.sale;
  }

  async listRecentSales(locationId: string, limit = 30) {
    const take = Math.min(Math.max(Number(limit) || 30, 1), 100);
    return this.prisma.pharmacySale.findMany({
      where: { locationId },
      include: {
        items: { include: { batch: { select: { batchNumber: true, expiryDate: true } } } },
        soldByUser: { select: { fullName: true, username: true } },
        location: { select: { code: true, name: true, address: true, phone: true } },
        prescription: { include: { visit: { include: { patient: true } } } },
      },
      orderBy: { paidAt: 'desc' },
      take,
    });
  }

  async findSaleById(id: string, locationId: string) {
    const sale = await this.prisma.pharmacySale.findFirst({
      where: { id, locationId },
      include: {
        items: { include: { batch: { select: { batchNumber: true, expiryDate: true } } } },
        soldByUser: { select: { fullName: true, username: true } },
        location: { select: { code: true, name: true, address: true, phone: true } },
        prescription: { include: { visit: { include: { patient: true } } } },
      },
    });
    if (!sale) throw new NotFoundException('Pharmacy sale not found');
    return sale;
  }

  // --- Daily Closures & Register Sessions ---
  async findActiveSession(userId: string, locationId: string) {
    return this.prisma.pharmacyDailyClosure.findFirst({
      where: {
        openedByUserId: userId,
        locationId,
        status: 'open',
      },
      include: {
        sales: {
          where: { status: { not: 'voided' } },
          include: {
            items: true,
            visit: {
              include: { patient: true }
            }
          }
        }
      }
    });
  }

  async openSession(userId: string, openingFloat: number, locationId: string) {
    const floatVal = Number(openingFloat);
    if (!Number.isFinite(floatVal) || floatVal < 0) {
      throw new BadRequestException('Opening float must be a valid positive number');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const active = await tx.pharmacyDailyClosure.findFirst({
          where: { openedByUserId: userId, locationId, status: { in: ['open', 'closing'] } },
        });
        if (active) throw new BadRequestException('A register session is already active for this cashier.');
        const session = await tx.pharmacyDailyClosure.create({
          data: { openedByUserId: userId, locationId, openingFloat: floatVal, status: 'open' },
        });
        await tx.auditLog.create({
          data: {
            actionType: 'open',
            entityType: 'pharmacy_register_session',
            entityId: session.id,
            afterData: JSON.stringify({ locationId, openingFloat: floatVal }),
            actorUserId: userId,
          },
        });
        return session;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('A register session is already active for this cashier.');
      throw error;
    }
  }

  async getUnclosedSalesSummary(userId: string, locationId: string) {
    const activeSession = await this.findActiveSession(userId, locationId);
    if (!activeSession) {
      return {
        salesCount: 0,
        salesTotal: 0,
        cashTotal: 0,
        momoTotal: 0,
        sales: [],
        openingFloat: 0,
      };
    }

    const sales = activeSession.sales;
    const salesCount = sales.length;
    const salesTotal = sales.reduce((sum, s) => sum + Number(s.total), 0);
    const cashTotal = sales.reduce((sum, s) => s.paymentMethod === 'cash' ? sum + Number(s.total) : sum, 0);
    const momoTotal = sales.reduce((sum, s) => s.paymentMethod === 'mobile_money' ? sum + Number(s.total) : sum, 0);

    return {
      salesCount,
      salesTotal,
      cashTotal,
      momoTotal,
      sales,
      openingFloat: Number(activeSession.openingFloat),
    };
  }

  async closeSession(userId: string, data: any, locationId: string) {
    const cashCounted = Number(data.cashCounted ?? 0);
    const momoCounted = Number(data.momoCounted ?? 0);
    const notes = data.notes ?? null;

    if (!Number.isFinite(cashCounted) || !Number.isFinite(momoCounted) || cashCounted < 0 || momoCounted < 0) {
      throw new BadRequestException('Counted cash and mobile money must be valid positive numbers');
    }
    const closedSession = await this.prisma.$transaction(async (tx) => {
      const active = await tx.pharmacyDailyClosure.findFirst({
        where: { openedByUserId: userId, locationId, status: 'open' },
        select: { id: true },
      });
      if (!active) throw new BadRequestException('No active register session found to close.');
      const claim = await tx.pharmacyDailyClosure.updateMany({
        where: { id: active.id, openedByUserId: userId, locationId, status: 'open' },
        data: { status: 'closing' },
      });
      if (claim.count !== 1) throw new ConflictException('The register session is already closing.');

      const activeSession = await tx.pharmacyDailyClosure.findUniqueOrThrow({
        where: { id: active.id },
        include: { sales: { where: { status: { not: 'voided' } } } },
      });
      const totalSalesCount = activeSession.sales.length;
      const totalSalesAmount = activeSession.sales.reduce((sum, sale) => sum + Number(sale.total), 0);
      const cashSales = activeSession.sales.reduce((sum, sale) => sale.paymentMethod === 'cash' ? sum + Number(sale.total) : sum, 0);
      const momoSales = activeSession.sales.reduce((sum, sale) => sale.paymentMethod === 'mobile_money' ? sum + Number(sale.total) : sum, 0);
      const totalCounted = cashCounted + momoCounted;
      const expectedCash = cashSales + Number(activeSession.openingFloat);
      const expectedMomo = momoSales;
      const discrepancy = totalCounted - expectedCash - expectedMomo;

      const closed = await tx.pharmacyDailyClosure.update({
        where: { id: active.id },
        data: {
          status: 'closed',
          closedByUserId: userId,
          closureDate: getInternetDate(),
          totalSalesCount,
          totalSalesAmount,
          expectedCash,
          expectedMomo,
          cashCounted,
          momoCounted,
          totalCounted,
          discrepancy,
          notes: notes ? String(notes).trim().slice(0, 1000) : null,
        },
        include: {
          sales: true,
          openedByUser: { select: { fullName: true, username: true } },
          closedByUser: { select: { fullName: true, username: true } },
          location: { select: { code: true, name: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          actionType: 'close',
          entityType: 'pharmacy_register_session',
          entityId: active.id,
          afterData: JSON.stringify({ locationId, totalSalesCount, totalSalesAmount, expectedCash, expectedMomo, cashCounted, momoCounted, discrepancy }),
          actorUserId: userId,
        },
      });
      return closed;
    });

    const discrepancy = Number(closedSession.discrepancy ?? 0);
    if (Math.abs(discrepancy) > 0.01) {
      await this.notificationsService.create({
        title: 'Pharmacy register discrepancy',
        message: `${closedSession.location?.name ?? 'A pharmacy register'} closed with a discrepancy of GHS ${discrepancy.toFixed(2)}.`,
        type: 'danger',
        module: 'accounting',
        targetRoles: [0, 5],
        entityType: 'pharmacyDailyClosure',
        entityId: closedSession.id,
        route: '/admin/financials',
      });
    }
    return closedSession;
  }

  async findAllClosures(locationId: string, startDate?: string, endDate?: string) {
    const where: any = {
      status: 'closed',
      locationId,
      closureDate: buildDateRange(startDate, endDate, { defaultDays: 31, maxDays: 366 }),
    };

    return this.prisma.pharmacyDailyClosure.findMany({
      where,
      include: {
        closedByUser: {
          select: { fullName: true, username: true }
        }
      },
      orderBy: { closureDate: 'desc' },
      take: 100,
    });
  }

  async findClosureById(id: string, locationId: string) {
    const closure = await this.prisma.pharmacyDailyClosure.findFirst({
      where: { id, locationId },
      include: {
        openedByUser: {
          select: { fullName: true, username: true }
        },
        closedByUser: {
          select: { fullName: true, username: true }
        },
        sales: {
          include: {
            items: true,
            visit: {
              include: { patient: true }
            }
          }
        }
      }
    });

    if (!closure) {
      throw new NotFoundException('Pharmacy daily closure session not found.');
    }

    return closure;
  }
}
