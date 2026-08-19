import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';
import * as crypto from 'crypto';
import { buildDateRange } from '../common/date-range';

@Injectable()
export class PharmacyPayablesService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvoiceForReceipt(tx: any, receipt: any, supplier: any, data: any) {
    const invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : new Date(receipt.receivedAt);
    if (Number.isNaN(invoiceDate.getTime())) throw new BadRequestException('Supplier invoice date is invalid');
    const defaultDueDate = new Date(invoiceDate);
    defaultDueDate.setUTCDate(defaultDueDate.getUTCDate() + Number(supplier.paymentTermsDays ?? 0));
    const dueDate = data.dueDate ? new Date(data.dueDate) : defaultDueDate;
    if (Number.isNaN(dueDate.getTime())) throw new BadRequestException('Supplier invoice due date is invalid');
    if (dueDate < invoiceDate) throw new BadRequestException('Supplier invoice due date cannot be before its invoice date');

    return tx.pharmacySupplierInvoice.create({
      data: {
        tenantId: receipt.tenantId,
        locationId: receipt.locationId,
        supplierId: supplier.id,
        receiptId: receipt.id,
        createdByUserId: receipt.createdByUserId,
        invoiceNumber: `PINV-${getInternetDate().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        supplierInvoiceNumber: data.supplierInvoiceNumber ? String(data.supplierInvoiceNumber).trim().toUpperCase() : `GRN-${receipt.receiptNumber}`,
        invoiceDate,
        dueDate,
        totalAmount: Number(receipt.totalCost),
        balanceDue: Number(receipt.totalCost),
        status: 'unpaid',
        notes: data.invoiceNotes ? String(data.invoiceNotes).trim() : null,
      },
    });
  }

  async getSummary(locationId: string) {
    const invoices = await this.prisma.pharmacySupplierInvoice.findMany({
      where: { locationId, status: { not: 'voided' } },
      select: { balanceDue: true, dueDate: true, status: true },
    });
    const today = this.todayStart();
    return {
      invoiceCount: invoices.length,
      outstandingBalance: invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.balanceDue)), 0),
      overdueBalance: invoices.reduce((sum, invoice) => sum + (invoice.dueDate < today ? Math.max(0, Number(invoice.balanceDue)) : 0), 0),
      supplierCredit: invoices.reduce((sum, invoice) => sum + Math.max(0, -Number(invoice.balanceDue)), 0),
      unpaidCount: invoices.filter((invoice) => Number(invoice.balanceDue) > 0).length,
      overdueCount: invoices.filter((invoice) => invoice.dueDate < today && Number(invoice.balanceDue) > 0).length,
    };
  }

  async listInvoices(locationId: string, status?: string, supplierId?: string, search?: string) {
    const normalizedStatus = String(status ?? 'all').trim().toLowerCase();
    const today = this.todayStart();
    const invoices = await this.prisma.pharmacySupplierInvoice.findMany({
      where: {
        locationId,
        ...(supplierId ? { supplierId } : {}),
        ...(normalizedStatus === 'overdue'
          ? { dueDate: { lt: today }, balanceDue: { gt: 0 } }
          : normalizedStatus !== 'all'
            ? { status: normalizedStatus }
            : {}),
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search, mode: 'insensitive' } },
                { supplierInvoiceNumber: { contains: search, mode: 'insensitive' } },
                { supplier: { name: { contains: search, mode: 'insensitive' } } },
                { receipt: { receiptNumber: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        supplier: { select: { id: true, supplierCode: true, name: true, paymentTermsDays: true } },
        location: { select: { id: true, code: true, name: true } },
        receipt: { select: { id: true, receiptNumber: true, receivedAt: true } },
        _count: { select: { payments: true, purchaseReturns: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { invoiceDate: 'desc' }],
      take: 250,
    });
    return invoices.map((invoice) => ({ ...invoice, isOverdue: Number(invoice.balanceDue) > 0 && invoice.dueDate < today }));
  }

  async findInvoiceDetail(invoiceId: string, locationId: string) {
    const invoice = await this.prisma.pharmacySupplierInvoice.findFirst({
      where: { id: invoiceId, locationId },
      include: {
        supplier: true,
        location: { select: { id: true, code: true, name: true } },
        createdBy: { select: { fullName: true, username: true } },
        receipt: {
          include: {
            lines: {
              include: {
                product: { select: { id: true, productCode: true, name: true, unitOfMeasure: true } },
                batch: { select: { id: true, batchNumber: true, expiryDate: true, quantityRemaining: true, quantityReserved: true, quantityQuarantined: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        payments: { include: { createdBy: { select: { fullName: true, username: true } }, expense: true }, orderBy: { paymentDate: 'desc' } },
        purchaseReturns: {
          include: { createdBy: { select: { fullName: true, username: true } }, lines: { include: { product: { select: { name: true, unitOfMeasure: true } } } } },
          orderBy: { returnDate: 'desc' },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Supplier invoice not found');
    return { ...invoice, isOverdue: Number(invoice.balanceDue) > 0 && invoice.dueDate < this.todayStart() };
  }

  async updateInvoice(invoiceId: string, locationId: string, data: any, userId: string) {
    const invoice = await this.requireInvoice(invoiceId, locationId);
    const invoiceDate = data.invoiceDate !== undefined ? new Date(data.invoiceDate) : invoice.invoiceDate;
    const dueDate = data.dueDate !== undefined ? new Date(data.dueDate) : invoice.dueDate;
    if (Number.isNaN(invoiceDate.getTime()) || Number.isNaN(dueDate.getTime())) throw new BadRequestException('Invoice dates are invalid');
    if (dueDate < invoiceDate) throw new BadRequestException('Due date cannot be before invoice date');
    const supplierInvoiceNumber = data.supplierInvoiceNumber !== undefined
      ? String(data.supplierInvoiceNumber).trim().toUpperCase()
      : invoice.supplierInvoiceNumber;
    if (!supplierInvoiceNumber) throw new BadRequestException('Supplier invoice number is required');
    const duplicate = await this.prisma.pharmacySupplierInvoice.findFirst({
      where: { supplierId: invoice.supplierId, supplierInvoiceNumber, id: { not: invoiceId } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException(`Supplier invoice ${supplierInvoiceNumber} has already been recorded`);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.pharmacySupplierInvoice.update({
        where: { id: invoiceId },
        data: {
          supplierInvoiceNumber,
          invoiceDate,
          dueDate,
          notes: data.notes !== undefined ? (data.notes ? String(data.notes).trim() : null) : invoice.notes,
        },
      });
      await tx.auditLog.create({
        data: {
          actionType: 'update',
          entityType: 'pharmacy_supplier_invoice',
          entityId: invoiceId,
          beforeData: JSON.stringify({ supplierInvoiceNumber: invoice.supplierInvoiceNumber, invoiceDate: invoice.invoiceDate, dueDate: invoice.dueDate }),
          afterData: JSON.stringify({ supplierInvoiceNumber, invoiceDate, dueDate }),
          actorUserId: userId,
        },
      });
        return updated;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException(`Supplier invoice ${supplierInvoiceNumber} has already been recorded`);
      throw error;
    }
  }

  async recordPayment(data: any, userId: string, locationId: string) {
    const invoice = await this.requireInvoice(String(data.invoiceId ?? ''), locationId);
    if (invoice.createdByUserId === userId) {
      throw new BadRequestException('The supplier invoice recorder cannot approve their own payment');
    }
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Payment amount must be greater than zero');
    if (amount > Number(invoice.balanceDue) + 0.000001) throw new BadRequestException('Payment cannot exceed the invoice balance');
    const paymentMethod = String(data.paymentMethod ?? '').trim().toLowerCase();
    if (!['cash', 'mobile_money', 'bank_transfer', 'cheque', 'other'].includes(paymentMethod)) {
      throw new BadRequestException('Select a valid supplier payment method');
    }
    const referenceNumber = data.referenceNumber ? String(data.referenceNumber).trim().toUpperCase() : null;
    if (paymentMethod !== 'cash' && !referenceNumber) throw new BadRequestException('A payment reference is required for non-cash supplier payments');
    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : getInternetDate();
    if (Number.isNaN(paymentDate.getTime())) throw new BadRequestException('Payment date is invalid');
    const paymentNumber = `SPAY-${getInternetDate().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    try {
      return await this.prisma.$transaction(async (tx) => {
      if (referenceNumber) {
        const duplicateReference = await tx.pharmacySupplierPayment.findFirst({
          where: { referenceNumber },
          select: { id: true },
        });
        if (duplicateReference) throw new ConflictException('This supplier payment reference has already been used');
      }
      const updated = await tx.$executeRaw`
        UPDATE "PharmacySupplierInvoice"
        SET "paidAmount" = "paidAmount" + ${amount},
            "balanceDue" = "balanceDue" - ${amount},
            "status" = CASE WHEN ABS("balanceDue" - ${amount}) < 0.000001 THEN 'paid' ELSE 'partially_paid' END,
            "updatedAt" = ${getInternetDate()}
        WHERE "id" = ${invoice.id}
          AND "tenantId" = ${invoice.tenantId}
          AND "locationId" = ${locationId}
          AND "balanceDue" + 0.000001 >= ${amount}
      `;
      if (updated !== 1) throw new ConflictException('The invoice balance changed. Refresh and try again.');

      const expense = await tx.expense.create({
        data: {
          tenantId: invoice.tenantId,
          title: `Supplier payment - ${invoice.supplierInvoiceNumber}`,
          category: 'supplier_payment',
          amount,
          expenseDate: paymentDate,
          paymentMethod,
          referenceNumber,
          status: 'posted',
          notes: `Supplier: ${invoice.supplier.name}; Internal invoice: ${invoice.invoiceNumber}; Payment: ${paymentNumber}${referenceNumber ? `; Reference: ${referenceNumber}` : ''}`,
          createdById: userId,
        },
      });

      const payment = await tx.pharmacySupplierPayment.create({
        data: {
          tenantId: invoice.tenantId,
          locationId,
          supplierId: invoice.supplierId,
          invoiceId: invoice.id,
          createdByUserId: userId,
          expenseId: expense.id,
          paymentNumber,
          paymentDate,
          amount,
          paymentMethod,
          referenceNumber,
          notes: data.notes ? String(data.notes).trim() : null,
        },
        include: { supplier: true, invoice: true, expense: true, createdBy: { select: { fullName: true, username: true } } },
      });
      await tx.auditLog.create({
        data: {
          actionType: 'payment',
          entityType: 'pharmacy_supplier_invoice',
          entityId: invoice.id,
          beforeData: JSON.stringify({ balanceDue: Number(invoice.balanceDue) }),
          afterData: JSON.stringify({ paymentId: payment.id, paymentNumber, amount, paymentMethod, referenceNumber }),
          actorUserId: userId,
        },
      });
        return payment;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('This supplier payment reference has already been used');
      throw error;
    }
  }

  async recordPurchaseReturn(data: any, userId: string, locationId: string) {
    const receiptId = String(data.receiptId ?? '').trim();
    const receipt = await this.prisma.pharmacyGoodsReceipt.findFirst({
      where: { id: receiptId, locationId },
      include: { supplier: true, supplierInvoice: true, lines: { include: { batch: true, product: true } } },
    });
    if (!receipt || !receipt.supplier) throw new NotFoundException('Original supplier receipt not found');
    if (receipt.createdByUserId === userId) {
      throw new BadRequestException('The goods-receipt recorder cannot approve their own supplier return');
    }
    const sourceLines = Array.isArray(data.lines) ? data.lines : [];
    if (sourceLines.length === 0) throw new BadRequestException('Select at least one receipt line to return');
    const reason = String(data.reason ?? '').trim();
    if (reason.length < 3) throw new BadRequestException('A return reason is required');
    const returnDate = data.returnDate ? new Date(data.returnDate) : getInternetDate();
    if (Number.isNaN(returnDate.getTime())) throw new BadRequestException('Return date is invalid');

    const receiptLines = new Map(receipt.lines.map((line) => [line.id, line]));
    const seen = new Set<string>();
    const normalizedLines = sourceLines.map((line: any, index: number) => {
      const receiptLineId = String(line.receiptLineId ?? '').trim();
      if (seen.has(receiptLineId)) throw new BadRequestException('A receipt line can appear only once in a return');
      seen.add(receiptLineId);
      const receiptLine = receiptLines.get(receiptLineId);
      if (!receiptLine) throw new BadRequestException(`Return line ${index + 1} does not belong to the selected receipt`);
      const quantity = Number(line.quantity);
      const returnable = Number(receiptLine.quantityReceived) - Number(receiptLine.quantityReturned);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException(`Return line ${index + 1} quantity must be greater than zero`);
      if (quantity > returnable + 0.000001) throw new BadRequestException(`Return line ${index + 1} exceeds the ${returnable} units not previously returned`);
      const availableStock = Math.max(0, Number(receiptLine.batch.quantityRemaining) - Number(receiptLine.batch.quantityReserved ?? 0) - Number(receiptLine.batch.quantityQuarantined ?? 0));
      if (quantity > availableStock + 0.000001) throw new BadRequestException(`Return line ${index + 1} exceeds the ${availableStock} units not reserved for transfer`);
      const returnReason = line.returnReason ? String(line.returnReason).trim() : reason;
      return { receiptLine, quantity, returnReason, unitCost: Number(receiptLine.unitCost), lineTotal: quantity * Number(receiptLine.unitCost) };
    });
    const totalCredit = normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const returnNumber = `SRET-${getInternetDate().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const purchaseReturn = await tx.pharmacyPurchaseReturn.create({
        data: {
          tenantId: receipt.tenantId,
          locationId,
          supplierId: receipt.supplier!.id,
          receiptId: receipt.id,
          invoiceId: receipt.supplierInvoice?.id ?? null,
          createdByUserId: userId,
          returnNumber,
          returnDate,
          reason,
          notes: data.notes ? String(data.notes).trim() : null,
          totalCredit,
          status: 'posted',
        },
      });

      for (const line of normalizedLines) {
        const receiptLineUpdated = await tx.$executeRaw`
          UPDATE "PharmacyGoodsReceiptLine"
          SET "quantityReturned" = "quantityReturned" + ${line.quantity}
          WHERE "id" = ${line.receiptLine.id}
            AND "tenantId" = ${receipt.tenantId}
            AND "locationId" = ${locationId}
            AND "quantityReturned" + ${line.quantity} <= "quantityReceived" + 0.000001
        `;
        if (receiptLineUpdated !== 1) throw new ConflictException(`Returnable quantity changed for batch ${line.receiptLine.batchNumber}. Refresh and try again.`);
        const batchUpdated = await tx.pharmacyBatch.updateMany({
          where: { id: line.receiptLine.batchId, locationId, quantityRemaining: line.receiptLine.batch.quantityRemaining, quantityReserved: line.receiptLine.batch.quantityReserved, quantityQuarantined: line.receiptLine.batch.quantityQuarantined },
          data: { quantityRemaining: { decrement: line.quantity } },
        });
        if (batchUpdated.count !== 1) throw new ConflictException(`Stock changed for batch ${line.receiptLine.batchNumber}. Refresh and try again.`);
        const returnedBatch = await tx.pharmacyBatch.findUnique({ where: { id: line.receiptLine.batchId }, select: { quantityRemaining: true } });
        await tx.pharmacyPurchaseReturnLine.create({
          data: {
            tenantId: receipt.tenantId,
            returnId: purchaseReturn.id,
            receiptLineId: line.receiptLine.id,
            productId: line.receiptLine.productId,
            batchId: line.receiptLine.batchId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            lineTotal: line.lineTotal,
            returnReason: line.returnReason,
          },
        });
        await tx.pharmacyStockMovement.create({
          data: {
            tenantId: receipt.tenantId,
            locationId,
            productId: line.receiptLine.productId,
            batchId: line.receiptLine.batchId,
            movementType: 'supplier_return',
            quantity: -line.quantity,
            quantityBefore: Number(returnedBatch?.quantityRemaining ?? 0) + line.quantity,
            quantityAfter: Number(returnedBatch?.quantityRemaining ?? 0),
            unitCost: line.unitCost,
            referenceId: purchaseReturn.id,
            referenceType: 'supplier_return',
            reason: line.returnReason,
            createdByUserId: userId,
          },
        });
      }

      if (receipt.supplierInvoice) {
        await tx.$executeRaw`
          UPDATE "PharmacySupplierInvoice"
          SET "creditAmount" = "creditAmount" + ${totalCredit},
              "balanceDue" = "totalAmount" - "paidAmount" - ("creditAmount" + ${totalCredit}),
              "status" = CASE
                WHEN "totalAmount" - "paidAmount" - ("creditAmount" + ${totalCredit}) < -0.000001 THEN 'credit_due'
                WHEN ABS("totalAmount" - "paidAmount" - ("creditAmount" + ${totalCredit})) < 0.000001 THEN 'paid'
                WHEN "paidAmount" > 0 OR "creditAmount" + ${totalCredit} > 0 THEN 'partially_paid'
                ELSE 'unpaid'
              END,
              "updatedAt" = ${getInternetDate()}
          WHERE "id" = ${receipt.supplierInvoice.id}
            AND "tenantId" = ${receipt.tenantId}
        `;
      }

      await tx.auditLog.create({
        data: {
          actionType: 'post',
          entityType: 'pharmacy_purchase_return',
          entityId: purchaseReturn.id,
          beforeData: JSON.stringify({ receiptId: receipt.id, supplierInvoiceId: receipt.supplierInvoice?.id ?? null }),
          afterData: JSON.stringify({ returnNumber, totalCredit, reason }),
          actorUserId: userId,
        },
      });

      return tx.pharmacyPurchaseReturn.findUnique({
        where: { id: purchaseReturn.id },
        include: { supplier: true, receipt: true, invoice: true, lines: { include: { product: true, batch: true } }, createdBy: { select: { fullName: true, username: true } } },
      });
    });
  }

  async listPayments(locationId: string, supplierId?: string) {
    return this.prisma.pharmacySupplierPayment.findMany({
      where: { locationId, ...(supplierId ? { supplierId } : {}) },
      include: { supplier: true, invoice: { select: { invoiceNumber: true, supplierInvoiceNumber: true } }, createdBy: { select: { fullName: true, username: true } }, expense: true },
      orderBy: { paymentDate: 'desc' },
      take: 250,
    });
  }

  async listPurchaseReturns(locationId: string, supplierId?: string) {
    return this.prisma.pharmacyPurchaseReturn.findMany({
      where: { locationId, ...(supplierId ? { supplierId } : {}) },
      include: { supplier: true, receipt: { select: { receiptNumber: true } }, invoice: { select: { invoiceNumber: true, supplierInvoiceNumber: true } }, createdBy: { select: { fullName: true, username: true } }, lines: { include: { product: { select: { name: true, unitOfMeasure: true } }, batch: { select: { batchNumber: true } } } } },
      orderBy: { returnDate: 'desc' },
      take: 250,
    });
  }

  async getSupplierStatement(supplierId: string, startDate?: string, endDate?: string, locationId?: string) {
    const supplier = await this.prisma.pharmacySupplier.findFirst({ where: { id: supplierId } });
    if (!supplier) throw new NotFoundException('Pharmacy supplier not found');
    const dateFilter = buildDateRange(startDate, endDate, { defaultDays: 90, maxDays: 366 });
    const start = dateFilter.gte ?? null;
    const locationFilter = locationId ? { locationId } : {};
    const [invoices, payments, returns, priorInvoices, priorPayments, priorReturns] = await Promise.all([
      this.prisma.pharmacySupplierInvoice.findMany({ where: { supplierId, ...locationFilter, invoiceDate: dateFilter }, include: { location: { select: { code: true, name: true } }, }, take: 500 }),
      this.prisma.pharmacySupplierPayment.findMany({ where: { supplierId, ...locationFilter, paymentDate: dateFilter }, include: { location: { select: { code: true, name: true } }, invoice: { select: { supplierInvoiceNumber: true } } }, take: 500 }),
      this.prisma.pharmacyPurchaseReturn.findMany({ where: { supplierId, ...locationFilter, returnDate: dateFilter }, include: { location: { select: { code: true, name: true } }, receipt: { select: { receiptNumber: true } } }, take: 500 }),
      start ? this.prisma.pharmacySupplierInvoice.aggregate({ where: { supplierId, ...locationFilter, invoiceDate: { lt: start } }, _sum: { totalAmount: true } }) : Promise.resolve({ _sum: { totalAmount: 0 } }),
      start ? this.prisma.pharmacySupplierPayment.aggregate({ where: { supplierId, ...locationFilter, paymentDate: { lt: start } }, _sum: { amount: true } }) : Promise.resolve({ _sum: { amount: 0 } }),
      start ? this.prisma.pharmacyPurchaseReturn.aggregate({ where: { supplierId, ...locationFilter, returnDate: { lt: start } }, _sum: { totalCredit: true } }) : Promise.resolve({ _sum: { totalCredit: 0 } }),
    ]);
    const openingBalance = Number(priorInvoices._sum.totalAmount ?? 0) - Number(priorPayments._sum.amount ?? 0) - Number(priorReturns._sum.totalCredit ?? 0);
    const periodEntries = [
      ...invoices.map((invoice) => ({ id: invoice.id, date: invoice.invoiceDate, type: 'invoice', reference: invoice.supplierInvoiceNumber, description: `Supplier invoice ${invoice.supplierInvoiceNumber}`, debit: Number(invoice.totalAmount), credit: 0, location: invoice.location })),
      ...payments.map((payment) => ({ id: payment.id, date: payment.paymentDate, type: 'payment', reference: payment.paymentNumber, description: `Payment for ${payment.invoice.supplierInvoiceNumber}`, debit: 0, credit: Number(payment.amount), location: payment.location })),
      ...returns.map((purchaseReturn) => ({ id: purchaseReturn.id, date: purchaseReturn.returnDate, type: 'return', reference: purchaseReturn.returnNumber, description: `Supplier return from ${purchaseReturn.receipt.receiptNumber}`, debit: 0, credit: Number(purchaseReturn.totalCredit), location: purchaseReturn.location })),
    ].sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
    const entries = start
      ? [{ id: 'opening', date: start, type: 'opening', reference: 'OPENING', description: 'Balance before selected period', debit: 0, credit: 0, location: { code: 'ALL', name: 'All locations' } }, ...periodEntries]
      : periodEntries;
    let runningBalance = openingBalance;
    return {
      supplier,
      entries: entries.map((entry, index) => {
        if (entry.type === 'opening') return { ...entry, balance: openingBalance };
        runningBalance += entry.debit - entry.credit;
        return { ...entry, balance: runningBalance };
      }),
      totals: {
        openingBalance,
        invoiced: periodEntries.reduce((sum, entry) => sum + entry.debit, 0),
        paid: payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
        returned: returns.reduce((sum, purchaseReturn) => sum + Number(purchaseReturn.totalCredit), 0),
        balance: runningBalance,
      },
    };
  }

  private async requireInvoice(invoiceId: string, locationId: string) {
    if (!invoiceId) throw new BadRequestException('Supplier invoice is required');
    const invoice = await this.prisma.pharmacySupplierInvoice.findFirst({
      where: { id: invoiceId, locationId },
      include: { supplier: true },
    });
    if (!invoice) throw new NotFoundException('Supplier invoice not found');
    if (invoice.status === 'voided') throw new ConflictException('This supplier invoice is voided');
    return invoice;
  }

  private todayStart(): Date {
    const today = getInternetDate();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }
}
