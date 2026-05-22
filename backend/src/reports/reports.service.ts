import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClinicStream(startDate?: string, endDate?: string) {
    const whereClause: any = {};
    if (startDate || endDate) {
      whereClause.paidAt = {};
      if (startDate) {
        whereClause.paidAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.paidAt.lte = new Date(endDate);
      }
    }

    return this.prisma.clinicPayment.findMany({
      where: {
        paidAt: whereClause.paidAt,
      },
      include: {
        invoice: {
          include: {
            visit: {
              include: { patient: true },
            },
          },
        },
        receivedByUser: {
          select: { fullName: true, username: true },
        },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  async getPharmacyStream(startDate?: string, endDate?: string) {
    const whereClause: any = {
      status: 'paid',
    };
    if (startDate || endDate) {
      whereClause.paidAt = {};
      if (startDate) {
        whereClause.paidAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.paidAt.lte = new Date(endDate);
      }
    }

    return this.prisma.pharmacySale.findMany({
      where: whereClause,
      include: {
        soldByUser: {
          select: { fullName: true, username: true },
        },
        visit: {
          include: { patient: true },
        },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  async getCombinedSummary(startDate?: string, endDate?: string) {
    const clinicPayments = await this.getClinicStream(startDate, endDate);
    const pharmacySales = await this.getPharmacyStream(startDate, endDate);

    // Sum totals
    const clinicTotal = clinicPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const pharmacyTotal = pharmacySales.reduce((sum, s) => sum + Number(s.total), 0);
    const combinedTotal = clinicTotal + pharmacyTotal;

    // Breakdown by payment method
    let clinicCash = 0;
    let clinicMomo = 0;
    clinicPayments.forEach((p) => {
      if (p.paymentMethod === 'cash') clinicCash += Number(p.amount);
      else clinicMomo += Number(p.amount);
    });

    let pharmacyCash = 0;
    let pharmacyMomo = 0;
    pharmacySales.forEach((s) => {
      if (s.paymentMethod === 'cash') pharmacyCash += Number(s.total);
      else pharmacyMomo += Number(s.total);
    });

    // Expiry & Stock warnings
    const products = await this.prisma.pharmacyProduct.findMany({
      include: { batches: true },
    });

    const lowStockAlerts: any[] = [];
    const expiryAlerts: any[] = [];
    const now = new Date();
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(now.getMonth() + 3);

    products.forEach((p) => {
      const stock = p.batches.reduce((sum, b) => sum + b.quantityRemaining, 0);
      if (stock <= p.reorderLevel) {
        lowStockAlerts.push({
          id: p.id,
          name: p.name,
          productCode: p.productCode,
          stockOnHand: stock,
          reorderLevel: p.reorderLevel,
          unitOfMeasure: p.unitOfMeasure,
        });
      }

      p.batches.forEach((b) => {
        const expDate = new Date(b.expiryDate);
        if (b.quantityRemaining > 0 && expDate <= threeMonthsFromNow) {
          const daysRemaining = Math.ceil(
            (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          expiryAlerts.push({
            productName: p.name,
            batchNumber: b.batchNumber,
            quantityRemaining: b.quantityRemaining,
            expiryDate: b.expiryDate,
            daysRemaining,
          });
        }
      });
    });

    return {
      clinicTotal,
      pharmacyTotal,
      combinedTotal,
      paymentMethodsBreakdown: {
        cash: clinicCash + pharmacyCash,
        mobileMoney: clinicMomo + pharmacyMomo,
      },
      clinicPaymentsCount: clinicPayments.length,
      pharmacySalesCount: pharmacySales.length,
      lowStockAlertsCount: lowStockAlerts.length,
      expiryAlertsCount: expiryAlerts.length,
      lowStockAlerts: lowStockAlerts.slice(0, 10), // return top 10
      expiryAlerts: expiryAlerts.slice(0, 10), // return top 10
    };
  }
}
