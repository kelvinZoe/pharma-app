import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';
import { TenantContextService } from '../common/multitenancy/tenant-context.service';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

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
    const active = await this.findActiveClinicSession(userId);
    if (active) {
      throw new BadRequestException('A clinic cashier session is already active for this user.');
    }

    const floatVal = Number(openingFloat);
    if (isNaN(floatVal) || floatVal < 0) {
      throw new BadRequestException('Opening float must be a valid positive number');
    }

    return (this.prisma as any).clinicCashSession.create({
      data: {
        openedByUserId: userId,
        openingFloat: floatVal,
        status: 'open',
        tenantId: TenantContextService.getTenantId(),
      },
    });
  }

  async closeClinicSession(userId: string, data: any) {
    const cashCounted = Number(data.cashCounted ?? 0);
    const momoCounted = Number(data.momoCounted ?? 0);
    const notes = data.notes ?? null;

    if (isNaN(cashCounted) || isNaN(momoCounted) || cashCounted < 0 || momoCounted < 0) {
      throw new BadRequestException('Counted cash and mobile money must be valid positive numbers');
    }

    const activeSession = await (this.prisma as any).clinicCashSession.findFirst({
      where: {
        openedByUserId: userId,
        status: 'open',
      },
      include: {
        payments: {
          where: { status: { not: 'voided' } },
        },
      },
    });

    if (!activeSession) {
      throw new BadRequestException('No active clinic cashier session found to close.');
    }

    const summary = this.calculateClinicSessionSummary(activeSession);
    const totalCounted = cashCounted + momoCounted;
    const discrepancy = totalCounted - (summary.expectedCash + summary.expectedMomo);

    return (this.prisma as any).clinicCashSession.update({
      where: { id: activeSession.id },
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
        notes,
      },
      include: {
        openedByUser: { select: { fullName: true, username: true } },
        closedByUser: { select: { fullName: true, username: true } },
        payments: true,
      },
    });
  }

  async findClinicSessions(startDate?: string, endDate?: string) {
    const where: any = { status: 'closed' };
    if (startDate || endDate) {
      where.closedAt = {};
      if (startDate) where.closedAt.gte = new Date(startDate);
      if (endDate) where.closedAt.lte = new Date(endDate);
    }

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
    });
  }

  async findClinicSessionById(id: string) {
    const session = await (this.prisma as any).clinicCashSession.findUnique({
      where: { id },
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
      const updatedInv = await this.prisma.clinicInvoice.update({
        where: { id: visit.invoice.id },
        data: {
          subtotal: computedSubtotal,
          total: computedSubtotal,
          balanceDue: computedSubtotal - Number(visit.invoice.amountPaid),
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
    const referenceNumber = data.referenceNumber ?? data.transactionReference ?? null;

    if (!paymentMethod || !amount) {
      throw new BadRequestException('paymentMethod and amount are required');
    }

    if (!['cash', 'mobile_money'].includes(paymentMethod)) {
      throw new BadRequestException('Payment method must be cash or mobile_money');
    }

    const activeSession = await (this.prisma as any).clinicCashSession.findFirst({
      where: {
        openedByUserId: userId,
        status: 'open',
      },
    });

    if (!activeSession) {
      throw new BadRequestException('Open a clinic cashier session before collecting clinic payments.');
    }

    const { invoice } = await this.getVisitInvoice(visitId);

    const balanceDue = Number(invoice.balanceDue);
    const paymentAmount = Number(amount);

    if (paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    // Strict V1 rule: Full payment only
    if (Math.abs(paymentAmount - balanceDue) > 0.01) {
      throw new BadRequestException(`Full payment required. Expected GHS ${balanceDue.toFixed(2)}, received GHS ${paymentAmount.toFixed(2)}.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create payment entry
      const payment = await tx.clinicPayment.create({
        data: {
          invoiceId: invoice.id,
          paymentMethod,
          amount: paymentAmount,
          referenceNumber: referenceNumber ?? null,
          receivedByUserId: userId,
          clinicCashSessionId: activeSession.id,
          tenantId: TenantContextService.getTenantId(),
        },
      });

      // 2. Update invoice status
      const updatedInvoice = await tx.clinicInvoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: Number(invoice.amountPaid) + paymentAmount,
          balanceDue: 0.00,
          status: 'paid',
          paidAt: getInternetDate(),
        },
      });

      // 3. Update visit status to 'paid' (or closed)
      await tx.visit.update({
        where: { id: visitId },
        data: { status: 'paid' },
      });

      // 4. Register action in AuditLog
      await tx.auditLog.create({
        data: {
          actionType: 'payment',
          entityType: 'invoice',
          entityId: invoice.id,
          afterData: JSON.stringify({ paymentId: payment.id, amount: paymentAmount, method: paymentMethod }),
          actorUserId: userId,
        },
      });

      return {
        payment,
        invoice: updatedInvoice,
      };
    });
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
