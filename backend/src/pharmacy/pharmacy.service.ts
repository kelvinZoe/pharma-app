import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PharmacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

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

    const result = await this.prisma.$transaction(async (tx) => {
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

    const result = await this.prisma.$transaction(async (tx) => {
      // Check for active open session
      const activeSession = await tx.pharmacyDailyClosure.findFirst({
        where: {
          openedByUserId: userId,
          status: 'open',
        },
      });

      if (!activeSession) {
        throw new BadRequestException('No active register session. Please open the register first.');
      }

      let subtotal = 0;
      const saleItemsToCreate: any[] = [];
      const productIdsSold = new Set<string>();

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
        productIdsSold.add(productId);

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

      // Create Sale header linked to session
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
          closureId: activeSession.id,
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

      const lowStockAlerts: Array<{ id: string; name: string; stockOnHand: number; reorderLevel: number }> = [];
      for (const productId of productIdsSold) {
        const productWithBatches = await tx.pharmacyProduct.findUnique({
          where: { id: productId },
          include: { batches: true },
        });
        if (productWithBatches) {
          const stockOnHand = productWithBatches.batches.reduce((sum, batch) => sum + Number(batch.quantityRemaining), 0);
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

      const savedSale = await tx.pharmacySale.findUnique({
        where: { id: sale.id },
        include: { items: true },
      });

      return { sale: savedSale, lowStockAlerts };
    });

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

  // --- Daily Closures & Register Sessions ---
  async findActiveSession(userId: string) {
    return this.prisma.pharmacyDailyClosure.findFirst({
      where: {
        openedByUserId: userId,
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

  async openSession(userId: string, openingFloat: number) {
    const active = await this.prisma.pharmacyDailyClosure.findFirst({
      where: {
        openedByUserId: userId,
        status: 'open',
      }
    });

    if (active) {
      throw new BadRequestException('A register session is already active for this cashier.');
    }

    const floatVal = Number(openingFloat);
    if (isNaN(floatVal) || floatVal < 0) {
      throw new BadRequestException('Opening float must be a valid positive number');
    }

    return this.prisma.pharmacyDailyClosure.create({
      data: {
        openedByUserId: userId,
        openingFloat: floatVal,
        status: 'open',
      }
    });
  }

  async getUnclosedSalesSummary(userId: string) {
    const activeSession = await this.findActiveSession(userId);
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

  async closeSession(userId: string, data: any) {
    const cashCounted = Number(data.cashCounted ?? 0);
    const momoCounted = Number(data.momoCounted ?? 0);
    const notes = data.notes ?? null;

    if (isNaN(cashCounted) || isNaN(momoCounted) || cashCounted < 0 || momoCounted < 0) {
      throw new BadRequestException('Counted cash and mobile money must be valid positive numbers');
    }

    const activeSession = await this.prisma.pharmacyDailyClosure.findFirst({
      where: {
        openedByUserId: userId,
        status: 'open',
      },
      include: {
        sales: {
          where: { status: { not: 'voided' } }
        }
      }
    });

    if (!activeSession) {
      throw new BadRequestException('No active register session found to close.');
    }

    const totalSalesCount = activeSession.sales.length;
    const totalSalesAmount = activeSession.sales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalCounted = cashCounted + momoCounted;

    // expected total includes opening float
    const expectedTotal = totalSalesAmount + Number(activeSession.openingFloat);
    const discrepancy = totalCounted - expectedTotal;

    return this.prisma.pharmacyDailyClosure.update({
      where: { id: activeSession.id },
      data: {
        status: 'closed',
        closedByUserId: userId,
        closureDate: getInternetDate(),
        totalSalesCount,
        totalSalesAmount,
        cashCounted,
        momoCounted,
        totalCounted,
        discrepancy,
        notes,
      },
      include: { sales: true }
    });
  }

  async findAllClosures(startDate?: string, endDate?: string) {
    const where: any = {
      status: 'closed',
    };
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
