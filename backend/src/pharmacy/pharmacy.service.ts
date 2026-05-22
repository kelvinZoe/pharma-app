import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PharmacyService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Products ---
  async findAllProducts() {
    const products = await this.prisma.pharmacyProduct.findMany({
      include: {
        batches: true,
      },
      orderBy: { name: 'asc' },
    });

    // Compute stock totals dynamically
    return products.map((p) => {
      const stockOnHand = p.batches.reduce((sum, b) => sum + b.quantityRemaining, 0);
      return {
        ...p,
        stockOnHand,
      };
    });
  }

  async createProduct(data: any) {
    if (!data.name || !data.unitOfMeasure) {
      throw new BadRequestException('Product name and unit of measure are required');
    }

    const productCode = data.productCode ?? `PXM-${Math.floor(1000 + Math.random() * 9000)}`;

    return this.prisma.pharmacyProduct.create({
      data: {
        name: data.name,
        productCode,
        unitOfMeasure: data.unitOfMeasure,
        reorderLevel: data.reorderLevel !== undefined ? Number(data.reorderLevel) : 10.0,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });
  }

  // --- Batches & Intakes ---
  async addBatch(productId: string, data: any, userId: string) {
    const { batchNumber, expiryDate, purchasePrice, sellingPrice, quantityReceived } = data;

    if (!batchNumber || !expiryDate || purchasePrice === undefined || sellingPrice === undefined || quantityReceived === undefined) {
      throw new BadRequestException('Batch number, expiry date, purchase/selling price, and quantity are required');
    }

    const product = await this.prisma.pharmacyProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Pharmacy product not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create batch
      const batch = await tx.pharmacyBatch.create({
        data: {
          productId,
          batchNumber,
          expiryDate: new Date(expiryDate),
          purchasePrice: Number(purchasePrice),
          sellingPrice: Number(sellingPrice),
          quantityReceived: Number(quantityReceived),
          quantityRemaining: Number(quantityReceived),
        },
      });

      // 2. Log positive stock movement
      await tx.pharmacyStockMovement.create({
        data: {
          productId,
          batchId: batch.id,
          movementType: 'purchase',
          quantity: Number(quantityReceived),
          unitCost: Number(purchasePrice),
          createdByUserId: userId,
        },
      });

      return batch;
    });
  }

  // --- Referred Prescriptions Queue ---
  async getActivePrescriptions() {
    return this.prisma.prescription.findMany({
      where: { status: 'active' },
      include: {
        visit: {
          include: { patient: true },
        },
        createdBy: {
          select: { fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Point of Sale (POS) Checkout ---
  async processSale(data: any, userId: string) {
    const { saleSource, visitId, prescriptionId, paymentMethod, items } = data;

    if (!paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Payment method and at least one item are required');
    }

    if (!['cash', 'mobile_money'].includes(paymentMethod)) {
      throw new BadRequestException('Payment method must be cash or mobile_money');
    }

    // Generate POS sale number PH-xxxxx
    const lastSale = await this.prisma.pharmacySale.findFirst({
      orderBy: { saleNumber: 'desc' },
    });

    let nextNum = 10001;
    if (lastSale && lastSale.saleNumber.startsWith('PH-')) {
      const lastNum = parseInt(lastSale.saleNumber.replace('PH-', ''), 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const saleNumber = `PH-${nextNum}`;

    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const saleItemsToCreate: any[] = [];

      for (const item of items) {
        const { productId, batchId, quantity } = item;

        if (!productId || !batchId || !quantity || Number(quantity) <= 0) {
          throw new BadRequestException('Invalid item fields or quantity');
        }

        const product = await tx.pharmacyProduct.findUnique({
          where: { id: productId },
        });

        if (!product) {
          throw new NotFoundException(`Product not found`);
        }

        const batch = await tx.pharmacyBatch.findUnique({
          where: { id: batchId },
        });

        if (!batch || batch.productId !== productId) {
          throw new NotFoundException(`Batch not found or mismatch`);
        }

        const qtyToSell = Number(quantity);

        if (batch.quantityRemaining < qtyToSell) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name} (Batch: ${batch.batchNumber}). Requested: ${qtyToSell}, Available: ${batch.quantityRemaining}`,
          );
        }

        // Deduct from batch
        await tx.pharmacyBatch.update({
          where: { id: batchId },
          data: {
            quantityRemaining: batch.quantityRemaining - qtyToSell,
          },
        });

        // Add negative stock movement
        await tx.pharmacyStockMovement.create({
          data: {
            productId,
            batchId,
            movementType: 'sale',
            quantity: -qtyToSell,
            unitCost: batch.sellingPrice,
            createdByUserId: userId,
          },
        });

        const lineTotal = Number(batch.sellingPrice) * qtyToSell;
        subtotal += lineTotal;

        saleItemsToCreate.push({
          productId,
          batchId,
          itemName: product.name,
          quantity: qtyToSell,
          unitPrice: batch.sellingPrice,
          lineTotal,
        });
      }

      // Create Sale header
      const sale = await tx.pharmacySale.create({
        data: {
          saleNumber,
          saleSource: saleSource ?? 'walk_in',
          visitId: visitId ?? null,
          prescriptionId: prescriptionId ?? null,
          subtotal,
          total: subtotal,
          paymentMethod,
          status: 'paid',
          soldByUserId: userId,
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
            lineTotal: saleItem.lineTotal,
          },
        });
      }

      // If prescription was filled, mark as dispensed
      if (prescriptionId) {
        await tx.prescription.update({
          where: { id: prescriptionId },
          data: { status: 'dispensed' },
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

      return tx.pharmacySale.findUnique({
        where: { id: sale.id },
        include: { items: true },
      });
    });
  }

  // --- Daily Closures ---
  async getUnclosedSalesSummary(userId: string) {
    const sales = await this.prisma.pharmacySale.findMany({
      where: {
        soldByUserId: userId,
        closureId: null,
        status: 'paid',
      },
      include: {
        items: true,
        visit: {
          include: { patient: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

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
    };
  }

  async closeSalesSession(userId: string, data: any) {
    const cashCounted = Number(data.cashCounted ?? 0);
    const momoCounted = Number(data.momoCounted ?? 0);
    const notes = data.notes ?? null;

    if (isNaN(cashCounted) || isNaN(momoCounted) || cashCounted < 0 || momoCounted < 0) {
      throw new BadRequestException('Counted cash and mobile money must be valid positive numbers');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch unclosed sales
      const sales = await tx.pharmacySale.findMany({
        where: {
          soldByUserId: userId,
          closureId: null,
          status: 'paid',
        }
      });

      if (sales.length === 0) {
        throw new BadRequestException('No unclosed sales found to perform closure.');
      }

      const totalSalesCount = sales.length;
      const totalSalesAmount = sales.reduce((sum, s) => sum + Number(s.total), 0);
      const totalCounted = cashCounted + momoCounted;
      const discrepancy = totalCounted - totalSalesAmount;

      // 2. Create the daily closure record
      const closure = await tx.pharmacyDailyClosure.create({
        data: {
          closedByUserId: userId,
          totalSalesCount,
          totalSalesAmount,
          cashCounted,
          momoCounted,
          totalCounted,
          discrepancy,
          notes,
        }
      });

      // 3. Associate sales with this closure
      await tx.pharmacySale.updateMany({
        where: {
          soldByUserId: userId,
          closureId: null,
          status: 'paid',
        },
        data: {
          closureId: closure.id
        }
      });

      // 4. Log audit event
      await tx.auditLog.create({
        data: {
          actionType: 'create',
          entityType: 'pharmacy_closure',
          entityId: closure.id,
          afterData: JSON.stringify({
            closureId: closure.id,
            totalSalesAmount,
            totalCounted,
            discrepancy
          }),
          actorUserId: userId
        }
      });

      return tx.pharmacyDailyClosure.findUnique({
        where: { id: closure.id },
        include: { sales: true }
      });
    });
  }

  async findAllClosures(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.closureDate = {};
      if (startDate) {
        where.closureDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.closureDate.lte = new Date(endDate);
      }
    }

    return this.prisma.pharmacyDailyClosure.findMany({
      where,
      include: {
        closedByUser: {
          select: { fullName: true, username: true }
        }
      },
      orderBy: { closureDate: 'desc' }
    });
  }

  async findClosureById(id: string) {
    const closure = await this.prisma.pharmacyDailyClosure.findUnique({
      where: { id },
      include: {
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

