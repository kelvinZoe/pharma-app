import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';
import { TenantContextService } from '../common/multitenancy/tenant-context.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildDateRange } from '../common/date-range';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findActiveClinicSession(userId: string) {
    const session = await (this.prisma as any).clinicCashSession.findFirst({
      where: {
        openedByUserId: userId,
        status: 'open',
      },
      include: {
        payments: {
          where: { status: { not: 'voided' } },
          include: {
            invoice: {
              include: {
                visit: {
                  include: { patient: true },
                },
              },
            },
          },
        },
      },
    });

    return session ? this.withClinicSessionSummary(session) : null;
  }

  async openClinicSession(userId: string, openingFloat: number) {
    const floatVal = Number(openingFloat);
    if (!Number.isFinite(floatVal) || floatVal < 0) {
      throw new BadRequestException('Opening float must be a valid positive number');
    }
    const tenantId = TenantContextService.getTenantId();
    if (!tenantId) throw new BadRequestException('Tenant context is required');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const active = await (tx as any).clinicCashSession.findFirst({
          where: { openedByUserId: userId, status: { in: ['open', 'closing'] } },
        });
        if (active) throw new BadRequestException('A clinic cashier session is already active for this user.');
        const session = await (tx as any).clinicCashSession.create({
          data: { openedByUserId: userId, openingFloat: floatVal, status: 'open', tenantId },
        });
        await tx.auditLog.create({
          data: {
            actionType: 'open',
            entityType: 'clinic_cash_session',
            entityId: session.id,
            afterData: JSON.stringify({ openingFloat: floatVal }),
            actorUserId: userId,
          },
        });
        return session;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('A clinic cashier session is already active for this user.');
      throw error;
    }
  }

  async closeClinicSession(userId: string, data: any) {
    const cashCounted = Number(data.cashCounted ?? 0);
    const momoCounted = Number(data.momoCounted ?? 0);
    const notes = data.notes ?? null;

    if (!Number.isFinite(cashCounted) || !Number.isFinite(momoCounted) || cashCounted < 0 || momoCounted < 0) {
      throw new BadRequestException('Counted cash and mobile money must be valid positive numbers');
    }
    const closedSession = await this.prisma.$transaction(async (tx) => {
      const active = await (tx as any).clinicCashSession.findFirst({
        where: { openedByUserId: userId, status: 'open' },
        select: { id: true },
      });
      if (!active) throw new BadRequestException('No active clinic cashier session found to close.');
      const claim = await (tx as any).clinicCashSession.updateMany({
        where: { id: active.id, openedByUserId: userId, status: 'open' },
        data: { status: 'closing' },
      });
      if (claim.count !== 1) throw new ConflictException('The cashier session is already closing.');

      const activeSession = await (tx as any).clinicCashSession.findUniqueOrThrow({
        where: { id: active.id },
        include: { payments: { where: { status: { not: 'voided' } } } },
      });
      const summary = this.calculateClinicSessionSummary(activeSession);
      const totalCounted = cashCounted + momoCounted;
      const discrepancy = totalCounted - (summary.expectedCash + summary.expectedMomo);
      const closed = await (tx as any).clinicCashSession.update({
        where: { id: active.id },
        data: {
          status: 'closed',
          closedByUserId: userId,
          closedAt: getInternetDate(),
          cashCounted,
          momoCounted,
          expectedCash: summary.expectedCash,
          expectedMomo: summary.expectedMomo,
          totalCounted,
          discrepancy,
          notes: notes ? String(notes).trim().slice(0, 1000) : null,
        },
        include: {
          openedByUser: { select: { fullName: true, username: true } },
          closedByUser: { select: { fullName: true, username: true } },
          payments: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actionType: 'close',
          entityType: 'clinic_cash_session',
          entityId: active.id,
          afterData: JSON.stringify({ cashCounted, momoCounted, expectedCash: summary.expectedCash, expectedMomo: summary.expectedMomo, discrepancy }),
          actorUserId: userId,
        },
      });
      return closed;
    });

    const discrepancy = Number(closedSession.discrepancy ?? 0);
    if (Math.abs(discrepancy) > 0.01) {
      await this.notificationsService.create({
        title: 'Clinic cashier discrepancy',
        message: `A clinic cashier session closed with a discrepancy of GHS ${discrepancy.toFixed(2)}.`,
        type: 'danger',
        module: 'accounting',
        targetRoles: [0, 5],
        entityType: 'clinicCashSession',
        entityId: closedSession.id,
        route: '/admin/financials',
      });
    }

    return closedSession;
  }

  async findClinicSessions(startDate?: string, endDate?: string, openedByUserId?: string, limit?: number) {
    const where: any = {
      status: 'closed',
      closedAt: buildDateRange(startDate, endDate, { defaultDays: 31, maxDays: 366 }),
      ...(openedByUserId ? { openedByUserId } : {}),
    };

    return (this.prisma as any).clinicCashSession.findMany({
      where,
      include: {
        openedByUser: { select: { fullName: true, username: true } },
        closedByUser: { select: { fullName: true, username: true } },
        payments: {
          where: { status: { not: 'voided' } },
        },
      },
      orderBy: { closedAt: 'desc' },
      take: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(Number(limit)), 1), 200) : 100,
    });
  }

  async findClinicSessionById(id: string, openedByUserId?: string) {
    const session = await (this.prisma as any).clinicCashSession.findFirst({
      where: { id, ...(openedByUserId ? { openedByUserId } : {}) },
      include: {
        openedByUser: { select: { fullName: true, username: true } },
        closedByUser: { select: { fullName: true, username: true } },
        payments: {
          include: {
            receivedByUser: { select: { fullName: true, username: true } },
            invoice: {
              include: {
                visit: {
                  include: { patient: true },
                },
              },
            },
          },
          orderBy: { paidAt: 'desc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Clinic cashier session not found.');
    }

    return this.withClinicSessionSummary(session);
  }

  async getVisitInvoice(visitId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: true,
        visitServices: {
          include: { service: true },
        },
        invoice: {
          include: { payments: true },
        },
      },
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    if (!visit.invoice) {
      throw new NotFoundException('Invoice not generated for this visit');
    }

    // Dynamic compilation to guarantee accuracy:
    // Only charge for lines that are NOT marked 'not_done'
    const billableLines = visit.visitServices.filter((s) => s.status !== 'not_done' && s.approvedByPatient !== false);
    const computedSubtotal = billableLines.reduce((sum, s) => sum + Number(s.lineTotal), 0);

    // If invoice data in DB differs from dynamically computed totals (e.g. from service status changes),
    // we update the database value.
    if (Number(visit.invoice.subtotal) !== computedSubtotal) {
      const amountPaid = Number(visit.invoice.amountPaid);
      const balanceDue = Math.max(0, computedSubtotal - amountPaid);
      const status = balanceDue <= 0.01 ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'unpaid';
      const updatedInv = await this.prisma.clinicInvoice.update({
        where: { id: visit.invoice.id },
        data: {
          subtotal: computedSubtotal,
          total: computedSubtotal,
          balanceDue,
          status,
          paidAt: status === 'paid' ? (visit.invoice.paidAt ?? getInternetDate()) : null,
        },
        include: { payments: true },
      });
      return {
        visit,
        invoice: updatedInv,
        billableLines,
      };
    }

    return {
      visit,
      invoice: visit.invoice,
      billableLines,
    };
  }

  async recordPayment(visitId: string, data: any, userId: string) {
    const { paymentMethod, amount } = data;
    const referenceNumber = String(data.referenceNumber ?? data.transactionReference ?? '').trim().toUpperCase() || null;

    if (!paymentMethod || amount === undefined || amount === null) {
      throw new BadRequestException('paymentMethod and amount are required');
    }

    if (!['cash', 'mobile_money'].includes(paymentMethod)) {
      throw new BadRequestException('Payment method must be cash or mobile_money');
    }
    if (paymentMethod === 'mobile_money' && !String(referenceNumber ?? '').trim()) {
      throw new BadRequestException('A mobile money reference is required');
    }

    const { invoice } = await this.getVisitInvoice(visitId);

    const balanceDue = Number(invoice.balanceDue);
    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    if (paymentAmount > balanceDue + 0.01) {
      throw new BadRequestException(`Payment cannot exceed the outstanding balance of GHS ${balanceDue.toFixed(2)}.`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
      const activeSession = await (tx as any).clinicCashSession.findFirst({
        where: { openedByUserId: userId, status: 'open' },
      });
      if (!activeSession) throw new BadRequestException('Open a clinic cashier session before collecting clinic payments.');
      const sessionTouch = await (tx as any).clinicCashSession.updateMany({
        where: { id: activeSession.id, openedByUserId: userId, status: 'open' },
        data: { updatedAt: getInternetDate() },
      });
      if (sessionTouch.count !== 1) throw new ConflictException('The cashier session is closing. Refresh before collecting payment.');

      if (paymentMethod === 'mobile_money') {
        const duplicateReference = await tx.clinicPayment.findFirst({
          where: { referenceNumber, status: { not: 'voided' } },
        });
        if (duplicateReference) throw new ConflictException('This mobile money reference has already been used');
      }
      const newAmountPaid = Number(invoice.amountPaid) + paymentAmount;
      const newBalanceDue = Math.max(0, balanceDue - paymentAmount);
      const newStatus = newBalanceDue <= 0.01 ? 'paid' : 'partially_paid';
      // 1. Create payment entry
      const payment = await tx.clinicPayment.create({
        data: {
          invoiceId: invoice.id,
          paymentMethod,
          amount: paymentAmount,
          referenceNumber,
          receivedByUserId: userId,
          clinicCashSessionId: activeSession.id,
          tenantId: TenantContextService.getTenantId(),
        },
      });

      // 2. Update invoice status
      const updateResult = await tx.clinicInvoice.updateMany({
        where: { id: invoice.id, balanceDue: invoice.balanceDue },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: newStatus,
          paidAt: newStatus === 'paid' ? getInternetDate() : null,
        },
      });
      if (updateResult.count !== 1) {
        throw new BadRequestException('The invoice balance changed. Refresh and try again.');
      }
      const updatedInvoice = await tx.clinicInvoice.findUniqueOrThrow({ where: { id: invoice.id } });

      // 3. Update visit status to 'paid' (or closed)
      await tx.visit.update({
        where: { id: visitId },
        data: { status: newStatus === 'paid' ? 'paid' : 'awaiting_payment' },
      });

      // 4. Register action in AuditLog
      await tx.auditLog.create({
        data: {
          actionType: 'payment',
          entityType: 'invoice',
          entityId: invoice.id,
          afterData: JSON.stringify({ paymentId: payment.id, amount: paymentAmount, method: paymentMethod, balanceDue: newBalanceDue }),
          actorUserId: userId,
        },
      });

      return {
        payment,
        invoice: updatedInvoice,
      };
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('This payment reference has already been used');
      throw error;
    }
  }

  private calculateClinicSessionSummary(session: any) {
    const payments = (session.payments ?? []).filter((p: any) => p.status !== 'voided');
    const cashPaymentsTotal = payments.reduce(
      (sum: number, p: any) => p.paymentMethod === 'cash' ? sum + Number(p.amount) : sum,
      0,
    );
    const momoPaymentsTotal = payments.reduce(
      (sum: number, p: any) => p.paymentMethod === 'mobile_money' ? sum + Number(p.amount) : sum,
      0,
    );

    return {
      paymentsCount: payments.length,
      paymentsTotal: cashPaymentsTotal + momoPaymentsTotal,
      cashPaymentsTotal,
      momoPaymentsTotal,
      expectedCash: Number(session.openingFloat ?? 0) + cashPaymentsTotal,
      expectedMomo: momoPaymentsTotal,
    };
  }

  private withClinicSessionSummary(session: any) {
    return {
      ...session,
      ...this.calculateClinicSessionSummary(session),
    };
  }
}
