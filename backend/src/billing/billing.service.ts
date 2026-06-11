import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

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
    const billableLines = visit.visitServices.filter((s) => s.status !== 'not_done');
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
    const { paymentMethod, amount, referenceNumber } = data;

    if (!paymentMethod || !amount) {
      throw new BadRequestException('paymentMethod and amount are required');
    }

    if (!['cash', 'mobile_money'].includes(paymentMethod)) {
      throw new BadRequestException('Payment method must be cash or mobile_money');
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
}
