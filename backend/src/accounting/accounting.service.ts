import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/multitenancy/tenant-context.service';
import { getInternetDate } from '../common/clock';
import {
  assertAccountingDateOpen,
  assertNoFinancialReversal,
} from '../common/accounting-period';
import { optionalMoney, zeroMoney } from '../common/money';

type ReversalType = 'clinic' | 'pharmacy' | 'expense';

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async listPeriods(page = 1, limit = 50) {
    const pagination = this.pagination(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.accountingPeriod.findMany({
        orderBy: { endDate: 'desc' },
        ...pagination.query,
      }),
      this.prisma.accountingPeriod.count(),
    ]);
    const users = await this.users(data.map((period) => period.lockedByUserId));
    return {
      data: data.map((period) => ({
        ...period,
        lockedByUser: users.get(period.lockedByUserId),
      })),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async lockPeriod(data: any, userId: string) {
    const startDate = this.date(data.startDate);
    const endDate = this.date(data.endDate);
    endDate.setUTCHours(23, 59, 59, 999);
    const today = this.date(getInternetDate().toISOString().slice(0, 10));
    if (endDate < startDate || endDate >= today) {
      throw new BadRequestException(
        'Select a completed period ending before today.',
      );
    }
    const reason = this.reason(data.reason);
    return this.prisma.$transaction(async (tx) => {
      await this.serializePeriod(tx);
      const overlap = await tx.accountingPeriod.findFirst({
        where: { startDate: { lte: endDate }, endDate: { gte: startDate } },
      });
      if (overlap)
        throw new ConflictException(
          'This range overlaps an existing locked period.',
        );
      const [clinic, pharmacy] = await Promise.all([
        tx.clinicCashSession.count({
          where: { status: 'open', openedAt: { lte: endDate } },
        }),
        tx.pharmacyDailyClosure.count({
          where: { status: 'open', createdAt: { lte: endDate } },
        }),
      ]);
      if (clinic + pharmacy > 0)
        throw new ConflictException(
          'Close all cashier shifts opened in or before this period first.',
        );
      const period = await tx.accountingPeriod.create({
        data: {
          tenantId: this.tenantId(),
          startDate,
          endDate,
          reason,
          lockedByUserId: userId,
        },
      });
      await this.audit(
        tx,
        'lock',
        'accounting_period',
        period.id,
        userId,
        period,
      );
      return period;
    });
  }

  async listReversals(page = 1, limit = 50) {
    const pagination = this.pagination(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.financialReversal.findMany({
        orderBy: { createdAt: 'desc' },
        ...pagination.query,
      }),
      this.prisma.financialReversal.count(),
    ]);
    const users = await this.users(
      data.flatMap((record) =>
        [record.requestedByUserId, record.reviewedByUserId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    );
    return {
      data: data.map((record) => ({
        ...record,
        requestedByUser: users.get(record.requestedByUserId),
        reviewedByUser: record.reviewedByUserId
          ? users.get(record.reviewedByUserId)
          : null,
      })),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async requestReversal(data: any, userId: string) {
    const entityType = this.entityType(data.entityType);
    const entityId = String(data.entityId ?? '').trim();
    if (!entityId) throw new BadRequestException('Select an entry to reverse.');
    const reason = this.reason(data.reason);
    return this.prisma.$transaction(async (tx) => {
      await this.serializePeriod(tx);
      const source = await this.source(tx, entityType, entityId);
      await assertNoFinancialReversal(tx, entityType, entityId);
      const reversal = await tx.financialReversal.create({
        data: {
          tenantId: this.tenantId(),
          entityType,
          entityId,
          reason,
          requestedByUserId: userId,
          amount: entityType === 'pharmacy' ? source.total : source.amount,
          costOfGoods:
            entityType === 'pharmacy'
              ? source.items.reduce(
                  (total: Prisma.Decimal, item: any) =>
                    total.plus(
                      optionalMoney(item.unitCost).times(item.quantity),
                    ),
                  zeroMoney(),
                )
              : zeroMoney(),
          paymentMethod: source.paymentMethod,
          locationId: entityType === 'pharmacy' ? source.locationId : null,
          sourceDate:
            entityType === 'expense' ? source.expenseDate : source.paidAt,
          clinicPaymentId: entityType === 'clinic' ? entityId : null,
          pharmacySaleId: entityType === 'pharmacy' ? entityId : null,
          expenseId: entityType === 'expense' ? entityId : null,
        },
      });
      await this.audit(
        tx,
        'request',
        'financial_reversal',
        reversal.id,
        userId,
        reversal,
      );
      return reversal;
    });
  }

  async reviewReversal(
    id: string,
    userId: string,
    approve: boolean,
    reason?: string,
  ) {
    const reviewReason = approve ? null : this.reason(reason);
    return this.prisma.$transaction(async (tx) => {
      const reversal = await tx.financialReversal.findFirst({ where: { id } });
      if (!reversal) throw new NotFoundException('Reversal request not found.');
      if (reversal.status !== 'pending')
        throw new ConflictException('This request has already been reviewed.');
      if (reversal.requestedByUserId === userId)
        throw new BadRequestException(
          'You cannot review your own reversal request.',
        );
      await this.serializePeriod(tx);
      const entityType = this.entityType(reversal.entityType);
      const source = await this.source(tx, entityType, reversal.entityId);
      const originalMaker =
        source.receivedByUserId ?? source.soldByUserId ?? source.createdById;
      if (approve && originalMaker === userId)
        throw new BadRequestException(
          'The original cashier or expense creator cannot approve this reversal.',
        );
      const postedAt = getInternetDate();
      if (approve) await assertAccountingDateOpen(tx, postedAt);
      const claim = await tx.financialReversal.updateMany({
        where: { id, status: 'pending', requestedByUserId: { not: userId } },
        data: {
          status: approve ? 'approved' : 'rejected',
          reviewedByUserId: userId,
          reviewedAt: postedAt,
          postedAt: approve ? postedAt : null,
          reviewReason,
        },
      });
      if (claim.count !== 1)
        throw new ConflictException('This request has already been reviewed.');
      if (approve && entityType === 'clinic') {
        const invoice = source.invoice;
        const amountPaid = Prisma.Decimal.max(
          zeroMoney(),
          optionalMoney(invoice.amountPaid).minus(reversal.amount),
        );
        const invoiceClaim = await tx.clinicInvoice.updateMany({
          where: {
            id: source.invoiceId,
            amountPaid: invoice.amountPaid,
            balanceDue: invoice.balanceDue,
          },
          data: {
            amountPaid,
            balanceDue: optionalMoney(invoice.balanceDue).plus(reversal.amount),
            status: amountPaid.gt(0) ? 'partially_paid' : 'unpaid',
            paidAt: null,
          },
        });
        if (invoiceClaim.count !== 1)
          throw new ConflictException(
            'The invoice balance changed. Refresh and retry.',
          );
        await tx.visit.update({
          where: { id: invoice.visitId },
          data: { status: 'completed' },
        });
      }
      if (approve && entityType === 'pharmacy') {
        for (const item of source.items) {
          if (!item.batchId)
            throw new ConflictException(
              'This sale has untraceable stock. Resolve its batch records before reversal.',
            );
          const batch = await tx.pharmacyBatch.findFirst({
            where: { id: item.batchId },
          });
          if (
            !batch ||
            batch.locationId !== source.locationId ||
            batch.productId !== item.productId
          ) {
            throw new ConflictException(
              'The original batch is unavailable at this location.',
            );
          }
          const updatedBatch = await tx.pharmacyBatch.update({
            where: { id: batch.id },
            data: {
              quantityRemaining: { increment: item.quantity },
              quantityQuarantined: { increment: item.quantity },
            },
          });
          await tx.pharmacyStockMovement.create({
            data: {
              productId: item.productId,
              batchId: batch.id,
              locationId: source.locationId,
              movementType: 'reversal_quarantine',
              quantity: item.quantity,
              quantityBefore: updatedBatch.quantityRemaining - item.quantity,
              quantityAfter: updatedBatch.quantityRemaining,
              unitCost: item.unitCost ?? item.unitPrice,
              createdByUserId: userId,
              referenceId: reversal.id,
              referenceType: 'financial_reversal',
              reason: reversal.reason,
            },
          });
        }
      }
      const result = await tx.financialReversal.findFirstOrThrow({
        where: { id },
      });
      await this.audit(
        tx,
        approve ? 'approve' : 'reject',
        'financial_reversal',
        id,
        userId,
        result,
      );
      return result;
    });
  }

  private async source(
    tx: Prisma.TransactionClient,
    entityType: ReversalType,
    id: string,
  ): Promise<any> {
    const tables = {
      clinic: Prisma.raw('"ClinicPayment"'),
      pharmacy: Prisma.raw('"PharmacySale"'),
      expense: Prisma.raw('"Expense"'),
    };
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM ${tables[entityType]} WHERE "id" = ${id} AND "tenantId" = ${this.tenantId()} FOR UPDATE`,
    );
    const source =
      entityType === 'clinic'
        ? await tx.clinicPayment.findFirst({
            where: { id },
            include: { invoice: true, clinicCashSession: true },
          })
        : entityType === 'pharmacy'
          ? await tx.pharmacySale.findFirst({
              where: { id },
              include: { items: true, closure: true },
            })
          : await tx.expense.findFirst({
              where: { id },
              include: { supplierPayment: true },
            });
    if (!source) throw new NotFoundException('Financial entry not found.');
    if (source.status !== (entityType === 'expense' ? 'posted' : 'paid'))
      throw new ConflictException('Only posted entries can be reversed.');
    if (
      entityType === 'expense' &&
      ((source as any).supplierPayment ||
        (source as any).category === 'supplier_payment')
    ) {
      throw new BadRequestException(
        'Supplier settlements must be corrected through Supplier Payables.',
      );
    }
    if (
      (source as any).clinicCashSession?.status === 'open' ||
      (source as any).closure?.status === 'open'
    ) {
      throw new ConflictException(
        'This cashier shift is still open. Use the existing void action before closing it.',
      );
    }
    return source;
  }

  private async serializePeriod(tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.tenantId()}, 0))::text`;
  }

  private tenantId(): string {
    const tenantId = TenantContextService.getTenantId();
    if (!tenantId) throw new BadRequestException('Tenant context is required.');
    return tenantId;
  }

  private entityType(value: unknown): ReversalType {
    if (value !== 'clinic' && value !== 'pharmacy' && value !== 'expense')
      throw new BadRequestException('Select clinic, pharmacy, or expense.');
    return value;
  }

  private date(value: unknown): Date {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException('Use a valid YYYY-MM-DD date.');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('Use a valid date.');
    return date;
  }

  private reason(value: unknown): string {
    const reason = String(value ?? '').trim();
    if (reason.length < 5 || reason.length > 1000)
      throw new BadRequestException(
        'Provide a reason between 5 and 1000 characters.',
      );
    return reason;
  }

  private pagination(page: number, limit: number) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit)
      ? Math.min(100, Math.max(1, limit))
      : 50;
    return {
      page: safePage,
      limit: safeLimit,
      query: { skip: (safePage - 1) * safeLimit, take: safeLimit },
    };
  }

  private audit(
    tx: Prisma.TransactionClient,
    actionType: string,
    entityType: string,
    entityId: string,
    userId: string,
    data: unknown,
  ) {
    return tx.auditLog.create({
      data: {
        actionType,
        entityType,
        entityId,
        actorUserId: userId,
        afterData: JSON.stringify(data),
      },
    });
  }

  private async users(ids: string[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, fullName: true, username: true },
    });
    return new Map(users.map((user) => [user.id, user]));
  }
}
