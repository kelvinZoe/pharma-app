import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/multitenancy/tenant-context.service';
import * as crypto from 'crypto';

@Injectable()
export class PharmacySupplierService {
  constructor(private readonly prisma: PrismaService) {}

  async listSuppliers(locationId?: string) {
    const suppliers = await this.prisma.pharmacySupplier.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    const [totals, invoices] = await Promise.all([
      this.prisma.pharmacyGoodsReceipt.groupBy({
        by: ['supplierId'],
        where: { supplierId: { not: null }, ...(locationId ? { locationId } : {}) },
        _count: { id: true },
        _sum: { totalCost: true },
        _max: { receivedAt: true },
      }),
      this.prisma.pharmacySupplierInvoice.findMany({
        where: { status: { not: 'voided' }, ...(locationId ? { locationId } : {}) },
        select: { supplierId: true, balanceDue: true },
      }),
    ]);
    const totalsBySupplier = new Map(totals.map((total) => [total.supplierId, total]));
    const balancesBySupplier = new Map<string, { outstanding: number; credit: number }>();
    for (const invoice of invoices) {
      const current = balancesBySupplier.get(invoice.supplierId) ?? { outstanding: 0, credit: 0 };
      const balance = Number(invoice.balanceDue);
      current.outstanding += Math.max(0, balance);
      current.credit += Math.max(0, -balance);
      balancesBySupplier.set(invoice.supplierId, current);
    }

    return suppliers.map((supplier) => {
      const summary = totalsBySupplier.get(supplier.id);
      return {
        ...supplier,
        receiptCount: summary?._count.id ?? 0,
        totalPurchases: Number(summary?._sum.totalCost ?? 0),
        latestDeliveryAt: summary?._max.receivedAt ?? null,
        outstandingBalance: balancesBySupplier.get(supplier.id)?.outstanding ?? 0,
        supplierCredit: balancesBySupplier.get(supplier.id)?.credit ?? 0,
      };
    });
  }

  async findSupplierDetail(supplierId: string, locationId?: string) {
    const supplier = await this.prisma.pharmacySupplier.findFirst({
      where: { id: supplierId },
      include: {
        goodsReceipts: {
          where: locationId ? { locationId } : undefined,
          include: {
            location: { select: { id: true, code: true, name: true } },
            lines: { include: { product: { select: { id: true, productCode: true, name: true } } } },
          },
          orderBy: { receivedAt: 'desc' },
          take: 50,
        },
        invoices: { where: locationId ? { locationId } : undefined, orderBy: { invoiceDate: 'desc' }, take: 50 },
        payments: { where: locationId ? { locationId } : undefined, orderBy: { paymentDate: 'desc' }, take: 50 },
        purchaseReturns: { where: locationId ? { locationId } : undefined, orderBy: { returnDate: 'desc' }, take: 50 },
      },
    });
    if (!supplier) throw new NotFoundException('Pharmacy supplier not found');

    const [allInvoiceBalances, paymentTotal, returnTotal, purchaseTotal] = await Promise.all([
      this.prisma.pharmacySupplierInvoice.findMany({
        where: { supplierId, status: { not: 'voided' }, ...(locationId ? { locationId } : {}) },
        select: { balanceDue: true },
      }),
      this.prisma.pharmacySupplierPayment.aggregate({ where: { supplierId, ...(locationId ? { locationId } : {}) }, _sum: { amount: true } }),
      this.prisma.pharmacyPurchaseReturn.aggregate({ where: { supplierId, status: 'posted', ...(locationId ? { locationId } : {}) }, _sum: { totalCredit: true } }),
      this.prisma.pharmacyGoodsReceipt.aggregate({ where: { supplierId, ...(locationId ? { locationId } : {}) }, _sum: { totalCost: true }, _count: { id: true }, _max: { receivedAt: true } }),
    ]);

    const totalPurchases = Number(purchaseTotal._sum.totalCost ?? 0);
    const suppliedMedicines = new Map<string, { id: string; productCode: string | null; name: string; receiptCount: number }>();
    for (const receipt of supplier.goodsReceipts) {
      for (const line of receipt.lines) {
        const existing = suppliedMedicines.get(line.productId);
        suppliedMedicines.set(line.productId, {
          ...line.product,
          receiptCount: (existing?.receiptCount ?? 0) + 1,
        });
      }
    }

    return {
      ...supplier,
      metrics: {
        receiptCount: purchaseTotal._count.id,
        totalPurchases,
        latestDeliveryAt: purchaseTotal._max.receivedAt ?? null,
        suppliedMedicineCount: suppliedMedicines.size,
        outstandingBalance: allInvoiceBalances.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.balanceDue)), 0),
        supplierCredit: allInvoiceBalances.reduce((sum, invoice) => sum + Math.max(0, -Number(invoice.balanceDue)), 0),
        paidAmount: Number(paymentTotal._sum.amount ?? 0),
        returnedValue: Number(returnTotal._sum.totalCredit ?? 0),
      },
      suppliedMedicines: [...suppliedMedicines.values()].sort((first, second) => first.name.localeCompare(second.name)),
    };
  }

  async createSupplier(data: any) {
    const tenantId = this.requireTenantId();
    const normalized = this.normalizeInput(data);
    await this.assertNoDuplicate(tenantId, normalized);

    return this.prisma.pharmacySupplier.create({
      data: {
        tenantId,
        supplierCode: normalized.supplierCode || `SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        ...normalized.data,
      },
    });
  }

  async updateSupplier(supplierId: string, data: any) {
    const tenantId = this.requireTenantId();
    const supplier = await this.prisma.pharmacySupplier.findFirst({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException('Pharmacy supplier not found');

    const normalized = this.normalizeInput({ ...supplier, ...data });
    await this.assertNoDuplicate(tenantId, normalized, supplierId);
    return this.prisma.pharmacySupplier.update({
      where: { id: supplierId },
      data: {
        ...(data.supplierCode !== undefined ? { supplierCode: normalized.supplierCode } : {}),
        ...normalized.data,
      },
    });
  }

  private normalizeInput(data: any) {
    const name = String(data.name ?? '').trim();
    if (name.length < 2) throw new BadRequestException('Supplier name must be at least 2 characters');
    const paymentTermsDays = Number(data.paymentTermsDays ?? 0);
    if (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365) {
      throw new BadRequestException('Payment terms must be between 0 and 365 days');
    }
    const supplierCode = data.supplierCode ? String(data.supplierCode).trim().toUpperCase() : '';
    if (supplierCode && !/^[A-Z0-9_-]{2,30}$/.test(supplierCode)) {
      throw new BadRequestException('Supplier code may contain letters, numbers, hyphens, and underscores');
    }
    const email = data.email ? String(data.email).trim().toLowerCase() : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Supplier email address is invalid');

    return {
      supplierCode,
      normalizedName: this.normalizeIdentity(name),
      phone: data.phone ? String(data.phone).replace(/[^\d+]/g, '').trim() : null,
      email,
      taxId: data.taxId ? String(data.taxId).replace(/\s+/g, '').trim().toUpperCase() : null,
      data: {
        name,
        normalizedName: this.normalizeIdentity(name),
        contactPerson: data.contactPerson ? String(data.contactPerson).trim() : null,
        phone: data.phone ? String(data.phone).replace(/[^\d+]/g, '').trim() : null,
        email,
        address: data.address ? String(data.address).trim() : null,
        taxId: data.taxId ? String(data.taxId).replace(/\s+/g, '').trim().toUpperCase() : null,
        paymentTermsDays,
        notes: data.notes ? String(data.notes).trim() : null,
        isActive: data.isActive !== undefined ? data.isActive === true : true,
      },
    };
  }

  private async assertNoDuplicate(tenantId: string, normalized: ReturnType<PharmacySupplierService['normalizeInput']>, excludedId?: string) {
    const duplicate = await this.prisma.pharmacySupplier.findFirst({
      where: {
        tenantId,
        ...(excludedId ? { id: { not: excludedId } } : {}),
        OR: [
          { normalizedName: normalized.normalizedName },
          ...(normalized.phone ? [{ phone: normalized.phone }] : []),
          ...(normalized.email ? [{ email: normalized.email }] : []),
          ...(normalized.taxId ? [{ taxId: normalized.taxId }] : []),
          ...(normalized.supplierCode ? [{ supplierCode: normalized.supplierCode }] : []),
        ],
      },
      select: { name: true },
    });
    if (duplicate) throw new ConflictException(`A matching supplier already exists: ${duplicate.name}`);
  }

  private normalizeIdentity(value: string): string {
    return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private requireTenantId(): string {
    const tenantId = TenantContextService.getTenantId();
    if (!tenantId) throw new BadRequestException('Tenant context is required');
    return tenantId;
  }
}
