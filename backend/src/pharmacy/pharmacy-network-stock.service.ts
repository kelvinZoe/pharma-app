import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';

@Injectable()
export class PharmacyNetworkStockService {
  constructor(private readonly prisma: PrismaService) {}

  async getNetworkStock(activeLocationId: string, accessibleLocationIds: string[], search = '') {
    const locationIds = [...new Set(accessibleLocationIds)];
    if (!locationIds.includes(activeLocationId)) throw new BadRequestException('Active pharmacy location is not accessible');
    const since = new Date(getInternetDate());
    since.setDate(since.getDate() - 30);
    const now = getInternetDate();

    const [locations, products, saleItems, inTransitLines] = await Promise.all([
      this.prisma.pharmacyLocation.findMany({ where: { id: { in: locationIds }, isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
      this.prisma.pharmacyProduct.findMany({
        where: search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { productCode: { contains: search, mode: 'insensitive' } }, { genericName: { contains: search, mode: 'insensitive' } }] } : undefined,
        include: {
          batches: { where: { locationId: { in: locationIds } }, orderBy: { expiryDate: 'asc' } },
          locationProducts: { where: { locationId: { in: locationIds } } },
        },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      this.prisma.pharmacySaleItem.findMany({ where: { locationId: { in: locationIds }, createdAt: { gte: since }, sale: { status: 'paid' } }, select: { locationId: true, productId: true, quantity: true } }),
      this.prisma.pharmacyTransferLine.findMany({
        where: { transfer: { status: 'dispatched', OR: [{ sourceLocationId: { in: locationIds } }, { destinationLocationId: { in: locationIds } }] } },
        include: { transfer: { select: { sourceLocationId: true, destinationLocationId: true } } },
      }),
    ]);

    const usage = new Map<string, number>();
    for (const item of saleItems) {
      if (!item.locationId) continue;
      const key = `${item.locationId}:${item.productId}`;
      usage.set(key, (usage.get(key) ?? 0) + Number(item.quantity));
    }
    const transitIn = new Map<string, number>();
    const transitOut = new Map<string, number>();
    for (const line of inTransitLines) {
      const quantity = Number(line.dispatchedQty ?? 0);
      const inKey = `${line.transfer.destinationLocationId}:${line.productId}`;
      const outKey = `${line.transfer.sourceLocationId}:${line.productId}`;
      transitIn.set(inKey, (transitIn.get(inKey) ?? 0) + quantity);
      transitOut.set(outKey, (transitOut.get(outKey) ?? 0) + quantity);
    }

    const rows: any[] = [];
    for (const product of products) {
      for (const location of locations) {
        const batches = product.batches.filter((batch) => batch.locationId === location.id);
        const policy = product.locationProducts.find((item) => item.locationId === location.id);
        const usageQuantity = usage.get(`${location.id}:${product.id}`) ?? 0;
        const incoming = transitIn.get(`${location.id}:${product.id}`) ?? 0;
        if (!policy && batches.length === 0 && usageQuantity <= 0 && incoming <= 0) continue;
        const averageDailyUsage = usageQuantity / 30;
        const onHand = batches.reduce((sum, batch) => sum + Number(batch.quantityRemaining), 0);
        const reserved = batches.reduce((sum, batch) => sum + Number(batch.quantityReserved ?? 0), 0);
        const quarantined = batches.reduce((sum, batch) => sum + Number(batch.quantityQuarantined ?? 0), 0);
        const expired = batches
          .filter((batch) => batch.expiryDate <= now)
          .reduce((sum, batch) => sum + Number(batch.quantityRemaining), 0);
        const available = batches
          .filter((batch) => batch.expiryDate > now)
          .reduce((sum, batch) => sum + this.available(batch), 0);
        const reorderLevel = Number(policy?.reorderLevel ?? product.reorderLevel ?? 0);
        const safetyStock = Number(policy?.safetyStock ?? 0);
        const supplierLeadTimeDays = Number(policy?.supplierLeadTimeDays ?? 7);
        const targetCoverDays = Number(policy?.targetCoverDays ?? 14);
        const demandTarget = averageDailyUsage * (supplierLeadTimeDays + targetCoverDays) + safetyStock;
        const targetStock = Number(policy?.maximumStock ?? Math.max(reorderLevel + safetyStock, demandTarget));
        const minimumRequired = Math.max(reorderLevel + safetyStock, averageDailyUsage * supplierLeadTimeDays + safetyStock);
        const outgoing = transitOut.get(`${location.id}:${product.id}`) ?? 0;
        rows.push({
          product: { id: product.id, name: product.name, productCode: product.productCode, unitOfMeasure: product.unitOfMeasure },
          location,
          onHand,
          available,
          reserved,
          quarantined,
          expired,
          inTransitIn: incoming,
          inTransitOut: outgoing,
          averageDailyUsage,
          daysOfStock: averageDailyUsage > 0 ? available / averageDailyUsage : null,
          reorderLevel,
          safetyStock,
          maximumStock: policy?.maximumStock === null || policy?.maximumStock === undefined ? null : Number(policy.maximumStock),
          supplierLeadTimeDays,
          targetCoverDays,
          targetStock,
          shortage: Math.max(0, targetStock - available - incoming),
          transferableExcess: Math.max(0, available - minimumRequired),
          nearestExpiry: batches.filter((batch) => batch.quantityRemaining > 0).map((batch) => batch.expiryDate).sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
          batches: batches.map((batch) => ({ id: batch.id, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, available: this.available(batch), purchasePrice: Number(batch.purchasePrice), sellingPrice: Number(batch.sellingPrice) })),
        });
      }
    }

    const recommendations = this.buildRecommendations(rows, activeLocationId);
    return {
      generatedAt: getInternetDate(),
      activeLocationId,
      locations,
      summary: {
        products: products.length,
        shortageLines: rows.filter((row) => row.shortage > 0.000001).length,
        excessLines: rows.filter((row) => row.transferableExcess > 0.000001).length,
        quarantinedUnits: rows.reduce((sum, row) => sum + row.quarantined, 0),
        expiredUnits: rows.reduce((sum, row) => sum + row.expired, 0),
        inTransitUnits: rows.reduce((sum, row) => sum + row.inTransitIn, 0),
      },
      rows,
      recommendations,
    };
  }

  async updatePolicy(locationId: string, productId: string, data: any, userId: string) {
    const [location, product] = await Promise.all([
      this.prisma.pharmacyLocation.findUnique({ where: { id: locationId } }),
      this.prisma.pharmacyProduct.findUnique({ where: { id: productId } }),
    ]);
    if (!location) throw new NotFoundException('Pharmacy location not found');
    if (!product) throw new NotFoundException('Medicine not found');
    const reorderLevel = this.nonNegative(data.reorderLevel, 'Reorder level');
    const safetyStock = this.nonNegative(data.safetyStock, 'Safety stock');
    const maximumStock = data.maximumStock === null || data.maximumStock === '' || data.maximumStock === undefined ? null : this.nonNegative(data.maximumStock, 'Maximum stock');
    const supplierLeadTimeDays = this.nonNegativeInteger(data.supplierLeadTimeDays, 'Supplier lead time');
    const targetCoverDays = this.positiveInteger(data.targetCoverDays, 'Target cover days');
    if (maximumStock !== null && maximumStock < reorderLevel + safetyStock) throw new BadRequestException('Maximum stock must be at least reorder level plus safety stock');

    const before = await this.prisma.pharmacyLocationProduct.findUnique({ where: { locationId_productId: { locationId, productId } } });
    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.pharmacyLocationProduct.upsert({
        where: { locationId_productId: { locationId, productId } },
        create: { tenantId: location.tenantId, locationId, productId, reorderLevel, safetyStock, maximumStock, supplierLeadTimeDays, targetCoverDays, isActive: true },
        update: { reorderLevel, safetyStock, maximumStock, supplierLeadTimeDays, targetCoverDays },
      });
      await tx.auditLog.create({
        data: { actionType: 'update', entityType: 'pharmacy_inventory_policy', entityId: policy.id, beforeData: before ? JSON.stringify({ reorderLevel: before.reorderLevel, safetyStock: before.safetyStock, maximumStock: before.maximumStock, supplierLeadTimeDays: before.supplierLeadTimeDays, targetCoverDays: before.targetCoverDays }) : null, afterData: JSON.stringify({ reorderLevel, safetyStock, maximumStock, supplierLeadTimeDays, targetCoverDays }), actorUserId: userId },
      });
      return policy;
    });
  }

  async listQuarantined(locationId: string) {
    return this.prisma.pharmacyBatch.findMany({
      where: { locationId, quantityQuarantined: { gt: 0 } },
      include: { product: { select: { id: true, name: true, productCode: true, unitOfMeasure: true } } },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      take: 250,
    });
  }

  async resolveQuarantine(batchId: string, locationId: string, data: any, userId: string) {
    const action = String(data.action ?? '').trim();
    if (!['release', 'write_off'].includes(action)) throw new BadRequestException('Select release or write_off');
    const quantity = Number(data.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Quarantine quantity must be greater than zero');
    const reason = String(data.reason ?? '').trim();
    if (reason.length < 5) throw new BadRequestException('A detailed quarantine resolution reason is required');

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.pharmacyBatch.findFirst({ where: { id: batchId, locationId } });
      if (!batch) throw new NotFoundException('Quarantined batch not found');
      if (quantity > Number(batch.quantityQuarantined) + 0.000001) throw new BadRequestException('Resolution quantity exceeds quarantined stock');
      const before = Number(batch.quantityRemaining);
      const after = action === 'write_off' ? before - quantity : before;
      const updated = await tx.pharmacyBatch.updateMany({
        where: { id: batch.id, locationId, quantityRemaining: batch.quantityRemaining, quantityQuarantined: batch.quantityQuarantined, quantityReserved: batch.quantityReserved },
        data: { quantityQuarantined: { decrement: quantity }, ...(action === 'write_off' ? { quantityRemaining: { decrement: quantity } } : {}) },
      });
      if (updated.count !== 1) throw new BadRequestException('Quarantined stock changed. Refresh and review the resolution again.');
      await tx.pharmacyStockMovement.create({
        data: { tenantId: batch.tenantId, locationId, productId: batch.productId, batchId: batch.id, movementType: action === 'write_off' ? 'quarantine_write_off' : 'quarantine_release', quantity: action === 'write_off' ? -quantity : 0, quantityBefore: before, quantityAfter: after, unitCost: batch.purchasePrice, referenceType: 'batch_quarantine', reason, createdByUserId: userId },
      });
      await tx.auditLog.create({
        data: { actionType: action, entityType: 'pharmacy_quarantine', entityId: batch.id, beforeData: JSON.stringify({ quantityRemaining: before, quantityQuarantined: Number(batch.quantityQuarantined) }), afterData: JSON.stringify({ quantityRemaining: after, quantityQuarantined: Number(batch.quantityQuarantined) - quantity, reason }), actorUserId: userId },
      });
      return { success: true, action, quantity, quantityRemaining: after, quantityQuarantined: Number(batch.quantityQuarantined) - quantity };
    });
  }

  private buildRecommendations(rows: any[], activeLocationId: string) {
    const recommendations: any[] = [];
    const shortages = rows.filter((row) => row.shortage > 0.000001);
    for (const destination of shortages) {
      let remainingShortage = Number(destination.shortage);
      const donors = rows
        .filter((row) => row.product.id === destination.product.id && row.location.id !== destination.location.id && row.transferableExcess > 0.000001)
        .sort((first, second) => second.transferableExcess - first.transferableExcess);
      for (const donor of donors) {
        if (remainingShortage <= 0.000001) break;
        let suggestedQuantity = Math.min(remainingShortage, Number(donor.transferableExcess));
        const suggestedLines: any[] = [];
        for (const batch of donor.batches.filter((item: any) => item.available > 0).sort((first: any, second: any) => new Date(first.expiryDate).getTime() - new Date(second.expiryDate).getTime())) {
          if (suggestedQuantity <= 0.000001) break;
          const daysToExpiry = Math.max(0, (new Date(batch.expiryDate).getTime() - getInternetDate().getTime()) / 86_400_000);
          const nearExpiry = daysToExpiry <= 90;
          const projectedUseBeforeExpiry = Number(destination.averageDailyUsage) * daysToExpiry;
          if (nearExpiry && projectedUseBeforeExpiry + 0.000001 < Math.min(suggestedQuantity, batch.available)) continue;
          const quantity = Math.min(suggestedQuantity, Number(batch.available));
          suggestedLines.push({ sourceBatchId: batch.id, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, quantity, nearExpiry });
          suggestedQuantity -= quantity;
        }
        const allocated = suggestedLines.reduce((sum, line) => sum + line.quantity, 0);
        if (allocated <= 0.000001) continue;
        recommendations.push({
          id: `${donor.location.id}:${destination.location.id}:${destination.product.id}`,
          sourceLocation: donor.location,
          destinationLocation: destination.location,
          product: destination.product,
          shortage: destination.shortage,
          donorExcess: donor.transferableExcess,
          recommendedQuantity: allocated,
          averageDailyUsage: destination.averageDailyUsage,
          destinationDaysOfStock: destination.daysOfStock,
          suggestedLines,
          canCreateFromActiveLocation: donor.location.id === activeLocationId,
          rationale: `FEFO allocation from ${donor.location.code}; destination target ${destination.targetStock.toFixed(2)} units.`,
        });
        remainingShortage -= allocated;
      }
    }
    return recommendations;
  }

  private available(batch: any): number {
    return Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityReserved ?? 0) - Number(batch.quantityQuarantined ?? 0));
  }

  private nonNegative(value: unknown, label: string): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new BadRequestException(`${label} must be zero or greater`);
    return number;
  }

  private nonNegativeInteger(value: unknown, label: string): number {
    const number = this.nonNegative(value, label);
    if (!Number.isInteger(number)) throw new BadRequestException(`${label} must be a whole number`);
    return number;
  }

  private positiveInteger(value: unknown, label: string): number {
    const number = this.nonNegativeInteger(value, label);
    if (number < 1) throw new BadRequestException(`${label} must be at least one day`);
    return number;
  }
}
