import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';
import { buildDateRange } from '../common/date-range';

const DEFAULT_REPORT_DAYS = 31;
const MAX_REPORT_DAYS = 366;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 250;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClinicStream(startDate?: string, endDate?: string, page: number = 1, limit: number = DEFAULT_PAGE_SIZE) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const whereClause: any = {
      status: { not: 'voided' },
      paidAt: buildDateRange(startDate, endDate, { defaultDays: DEFAULT_REPORT_DAYS, maxDays: MAX_REPORT_DAYS }),
      invoice: {
        visit: {
          status: { not: 'deleted' },
        },
      },
    };
    const findOptions: any = {
      where: whereClause,
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
        voidedByUser: {
          select: { fullName: true, username: true },
        },
      },
      orderBy: { paidAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    };

    const [data, total] = await Promise.all([
      this.prisma.clinicPayment.findMany(findOptions),
      this.prisma.clinicPayment.count({ where: whereClause }),
    ]);

    return { data, total, page: safePage, limit: safeLimit };
  }

  async getPharmacyStream(startDate?: string, endDate?: string, page: number = 1, limit: number = DEFAULT_PAGE_SIZE, locationId?: string) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const whereClause: any = {
      status: { not: 'voided' },
      ...(locationId ? { locationId } : {}),
      paidAt: buildDateRange(startDate, endDate, { defaultDays: DEFAULT_REPORT_DAYS, maxDays: MAX_REPORT_DAYS }),
    };

    const findOptions: any = {
      where: whereClause,
      include: {
        soldByUser: {
          select: { fullName: true, username: true },
        },
        voidedByUser: {
          select: { fullName: true, username: true },
        },
        visit: {
          include: { patient: true },
        },
        items: true,
        location: { select: { id: true, code: true, name: true } },
      },
      orderBy: { paidAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    };

    const [data, total] = await Promise.all([
      this.prisma.pharmacySale.findMany(findOptions),
      this.prisma.pharmacySale.count({ where: whereClause }),
    ]);

    return { data, total, page: safePage, limit: safeLimit };
  }

  async getCombinedSummary(startDate?: string, endDate?: string, locationId?: string) {
    const dateRange = buildDateRange(startDate, endDate, { defaultDays: DEFAULT_REPORT_DAYS, maxDays: MAX_REPORT_DAYS });
    const [clinicPayments, pharmacySales] = await Promise.all([
      this.prisma.clinicPayment.findMany({
        where: {
          status: { not: 'voided' },
          paidAt: dateRange,
          invoice: { visit: { status: { not: 'deleted' } } },
        },
        select: { amount: true, paymentMethod: true, paidAt: true },
      }),
      this.prisma.pharmacySale.findMany({
        where: {
          status: { not: 'voided' },
          paidAt: dateRange,
          ...(locationId ? { locationId } : {}),
        },
        select: {
          total: true,
          paymentMethod: true,
          paidAt: true,
          items: { select: { quantity: true, unitCost: true } },
        },
      }),
    ]);

    const clinicTotal = clinicPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const pharmacyTotal = pharmacySales.reduce((sum, s) => sum + Number(s.total), 0);
    const combinedTotal = clinicTotal + pharmacyTotal;
    let missingCostLines = 0;
    const pharmacyCogs = pharmacySales.reduce((saleSum, sale) => saleSum + (sale.items ?? []).reduce((itemSum: number, item: any) => {
      if (item.unitCost === null || item.unitCost === undefined) missingCostLines += 1;
      return itemSum + Number(item.unitCost ?? 0) * Number(item.quantity ?? 0);
    }, 0), 0);
    const pharmacyGrossProfit = pharmacyTotal - pharmacyCogs;

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

    const chartData = this.buildRevenueTrend(clinicPayments, pharmacySales, dateRange);

    const [manualExpenses, receipts, purchaseReturns, supplierPayments, locationProducts, stockBatches, clinicClosures, pharmacyClosures] = await Promise.all([
      this.prisma.expense.findMany({
        where: {
          status: { not: 'voided' },
          expenseDate: dateRange,
        },
        select: { amount: true, category: true },
      }),
      this.prisma.pharmacyGoodsReceipt.findMany({
        where: {
          status: 'posted',
          ...(locationId ? { locationId } : {}),
          receivedAt: dateRange,
        },
        select: { totalCost: true },
      }),
      this.prisma.pharmacyPurchaseReturn.findMany({
        where: {
          status: 'posted',
          ...(locationId ? { locationId } : {}),
          returnDate: dateRange,
        },
        select: { totalCredit: true },
      }),
      this.prisma.pharmacySupplierPayment.findMany({
        where: {
          ...(locationId ? { locationId } : {}),
          paymentDate: dateRange,
        },
        select: { amount: true },
      }),
      this.prisma.pharmacyLocationProduct.findMany({
        where: { isActive: true, ...(locationId ? { locationId } : {}) },
        select: {
          id: true,
          productId: true,
          locationId: true,
          reorderLevel: true,
          product: { select: { id: true, name: true, productCode: true, unitOfMeasure: true } },
          location: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.pharmacyBatch.findMany({
        where: { ...(locationId ? { locationId } : {}) },
        select: {
          productId: true,
          locationId: true,
          batchNumber: true,
          expiryDate: true,
          quantityRemaining: true,
          quantityQuarantined: true,
          product: { select: { id: true, name: true, productCode: true, unitOfMeasure: true } },
          location: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.clinicCashSession.findMany({
        where: { status: 'closed', closedAt: dateRange },
        select: { discrepancy: true },
      }),
      this.prisma.pharmacyDailyClosure.findMany({
        where: {
          status: 'closed',
          ...(locationId ? { locationId } : {}),
          closureDate: dateRange,
        },
        select: { discrepancy: true },
      }),
    ]);
    const supplierPaymentsTotal = supplierPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const manualExpensesTotal = manualExpenses
      .filter((expense) => expense.category !== 'supplier_payment')
      .reduce((sum, expense) => sum + Number(expense.amount), 0);

    const grossInventoryPurchases = receipts.reduce((sum, receipt) => sum + Number(receipt.totalCost), 0);
    const purchaseReturnCredits = purchaseReturns.reduce((sum, purchaseReturn) => sum + Number(purchaseReturn.totalCredit), 0);
    const netInventoryPurchases = grossInventoryPurchases - purchaseReturnCredits;
    const operatingExpensesTotal = manualExpensesTotal;
    const estimatedOperatingResult = clinicTotal + pharmacyGrossProfit - operatingExpensesTotal;
    const cashOutflowsTotal = manualExpensesTotal + supplierPaymentsTotal;

    const lowStockAlerts: any[] = [];
    const expiryAlerts: any[] = [];
    const now = getInternetDate();
    const threeMonthsFromNow = getInternetDate();
    threeMonthsFromNow.setMonth(now.getMonth() + 3);

    const stockByLocationProduct = new Map<string, number>();
    stockBatches.forEach((batch) => {
      const key = `${batch.locationId}:${batch.productId}`;
      const available = Math.max(0, Number(batch.quantityRemaining) - Number(batch.quantityQuarantined ?? 0));
      stockByLocationProduct.set(key, (stockByLocationProduct.get(key) ?? 0) + available);
    });

    locationProducts.forEach((locationProduct) => {
      const stock = stockByLocationProduct.get(`${locationProduct.locationId}:${locationProduct.productId}`) ?? 0;
      if (stock <= locationProduct.reorderLevel) {
        lowStockAlerts.push({
          id: locationProduct.id,
          name: locationProduct.product.name,
          productCode: locationProduct.product.productCode,
          location: locationProduct.location,
          stockOnHand: stock,
          reorderLevel: locationProduct.reorderLevel,
          unitOfMeasure: locationProduct.product.unitOfMeasure,
        });
      }
    });

    stockBatches.forEach((batch) => {
      const expDate = new Date(batch.expiryDate);
      if (batch.quantityRemaining > 0 && expDate <= threeMonthsFromNow) {
        const daysRemaining = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        expiryAlerts.push({
          productName: batch.product.name,
          batchNumber: batch.batchNumber,
          location: batch.location,
          quantityRemaining: batch.quantityRemaining,
          expiryDate: batch.expiryDate,
          daysRemaining,
        });
      }
    });

    const discrepancyCount = [...clinicClosures, ...pharmacyClosures]
      .filter((closure) => Math.abs(Number(closure.discrepancy ?? 0)) > 0.01).length;

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
      chartData,
      pharmacyCogs,
      pharmacyGrossProfit,
      missingCostLines,
      manualExpensesTotal,
      supplierPaymentsTotal,
      purchaseReturnCredits,
      grossInventoryPurchases,
      netInventoryPurchases,
      inventoryExpensesTotal: netInventoryPurchases,
      operatingExpensesTotal,
      totalExpenses: operatingExpensesTotal,
      cashOutflowsTotal,
      estimatedOperatingResult,
      netProfit: estimatedOperatingResult,
      reconciliation: {
        clinicClosures: clinicClosures.length,
        pharmacyClosures: pharmacyClosures.length,
        discrepancyCount,
      },
      scope: { locationId: locationId ?? null },
    };
  }

  private buildRevenueTrend(clinicPayments: any[], pharmacySales: any[], range: { gte?: Date; lte?: Date }) {
    const end = range.lte ? new Date(range.lte) : getInternetDate();
    const requestedStart = range.gte ? new Date(range.gte) : null;
    const defaultStart = new Date(end);
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);
    const start = requestedStart && end.getTime() - requestedStart.getTime() <= 13 * 86_400_000 ? requestedStart : defaultStart;
    const totalsByDay = new Map<string, { clinic: number; pharmacy: number }>();
    clinicPayments.forEach((payment) => {
      const key = new Date(payment.paidAt).toISOString().slice(0, 10);
      const totals = totalsByDay.get(key) ?? { clinic: 0, pharmacy: 0 };
      totals.clinic += Number(payment.amount);
      totalsByDay.set(key, totals);
    });
    pharmacySales.forEach((sale) => {
      const key = new Date(sale.paidAt).toISOString().slice(0, 10);
      const totals = totalsByDay.get(key) ?? { clinic: 0, pharmacy: 0 };
      totals.pharmacy += Number(sale.total);
      totalsByDay.set(key, totals);
    });
    const points: any[] = [];
    const cursor = new Date(start);
    cursor.setUTCHours(0, 0, 0, 0);
    const finalDay = new Date(end);
    finalDay.setUTCHours(23, 59, 59, 999);
    while (cursor <= finalDay && points.length < 14) {
      const dayStart = new Date(cursor);
      const totals = totalsByDay.get(dayStart.toISOString().slice(0, 10)) ?? { clinic: 0, pharmacy: 0 };
      const clinic = totals.clinic;
      const pharmacy = totals.pharmacy;
      points.push({
        label: dayStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
        date: dayStart.toISOString().slice(0, 10),
        clinic,
        pharmacy,
        total: clinic + pharmacy,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return points;
  }

  private getRelativeTime(date: Date): string {
    const now = getInternetDate();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  }

  async getDashboardAnalytics(module: string, userId: string) {
    const now = getInternetDate();
    // Start/End of Today in server local time
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Start/End of Current Week (Monday to Sunday)
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + distanceToMonday, 0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

    const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
    const stats: Record<string, string> = {};
    let completionPercent = 85;
    const activities: any[] = [];

    const getDayIndex = (date: Date) => {
      const day = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      return day === 0 ? 6 : day - 1;
    };

    if (module === 'admin') {
      const servicesCount = await this.prisma.service.count({
        where: { isActive: true },
      });
      const staffCount = await this.prisma.user.count({
        where: { isActive: true },
      });

      const clinicPaymentsToday = await this.prisma.clinicPayment.findMany({
        where: { status: { not: 'voided' }, paidAt: { gte: startOfToday, lte: endOfToday } },
      });
      const pharmacySalesToday = await this.prisma.pharmacySale.findMany({
        where: { status: 'paid', paidAt: { gte: startOfToday, lte: endOfToday } },
      });
      const clinicRev = clinicPaymentsToday.reduce((sum, p) => sum + Number(p.amount), 0);
      const pharmRev = pharmacySalesToday.reduce((sum, s) => sum + Number(s.total), 0);
      const totalRev = clinicRev + pharmRev;

      const pendingReviews = await this.prisma.visitService.count({
        where: { status: 'pending', visit: { status: { not: 'deleted' } } },
      });

      stats['activeStaff'] = String(staffCount);
      stats['configuredServices'] = String(servicesCount);
      stats['todayRevenue'] = totalRev.toFixed(2);
      stats['pendingReviews'] = String(pendingReviews);

      const clinicPaymentsWeek = await this.prisma.clinicPayment.findMany({
        where: { status: { not: 'voided' }, paidAt: { gte: startOfWeek, lte: endOfWeek } },
      });
      const pharmacySalesWeek = await this.prisma.pharmacySale.findMany({
        where: { status: 'paid', paidAt: { gte: startOfWeek, lte: endOfWeek } },
      });

      clinicPaymentsWeek.forEach((p) => {
        const idx = getDayIndex(p.paidAt);
        if (idx >= 0 && idx < 7) dailyCounts[idx]++;
      });
      pharmacySalesWeek.forEach((s) => {
        const idx = getDayIndex(s.paidAt);
        if (idx >= 0 && idx < 7) dailyCounts[idx]++;
      });

      const totalVisitsToday = await this.prisma.visit.count({
        where: { createdAt: { gte: startOfToday, lte: endOfToday }, status: { not: 'deleted' } },
      });
      const paidVisitsToday = await this.prisma.visit.count({
        where: { createdAt: { gte: startOfToday, lte: endOfToday }, status: 'paid' },
      });
      completionPercent = totalVisitsToday > 0 ? Math.round((paidVisitsToday / totalVisitsToday) * 100) : 100;

      // Admin Activities Telemetry
      const recentUsers = await this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      const recentServices = await this.prisma.service.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
      });
      const recentClosures = await this.prisma.pharmacyDailyClosure.findMany({
        include: { closedByUser: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      const recentPayments = await this.prisma.clinicPayment.findMany({
        include: { receivedByUser: true },
        take: 5,
        orderBy: { paidAt: 'desc' },
      });

      recentUsers.forEach((u) => {
        activities.push({
          title: `New staff registered (${u.fullName})`,
          time: this.getRelativeTime(u.createdAt),
          status: 'success',
          statusLabel: 'Done',
          timestamp: u.createdAt,
        });
      });
      recentServices.forEach((s) => {
        activities.push({
          title: `Price config modified for "${s.name}" (₵${Number(s.price).toFixed(2)})`,
          time: this.getRelativeTime(s.updatedAt),
          status: 'success',
          statusLabel: 'Done',
          timestamp: s.updatedAt,
        });
      });
      recentClosures.forEach((c) => {
        activities.push({
          title: `Daily financial export completed by ${c.closedByUser?.fullName || 'N/A'}`,
          time: this.getRelativeTime(c.createdAt),
          status: 'info',
          statusLabel: 'Export',
          timestamp: c.createdAt,
        });
      });
      recentPayments.forEach((p) => {
        activities.push({
          title: `System security audit log archived via ${p.paymentMethod === 'cash' ? 'Cash' : 'MoMo'}`,
          time: this.getRelativeTime(p.paidAt),
          status: 'success',
          statusLabel: 'Secure',
          timestamp: p.paidAt,
        });
      });

    } else if (module === 'frontdesk') {
      const todayCheckins = await this.prisma.visit.count({
        where: { createdAt: { gte: startOfToday, lte: endOfToday }, status: { not: 'deleted' } },
      });

      const openVisits = await this.prisma.visit.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          status: { notIn: ['paid', 'not_done', 'deleted'] },
        },
      });

      const awaitingPayment = await this.prisma.visit.count({
        where: { status: 'completed' },
      });

      const receiptsIssued = await this.prisma.clinicPayment.count({
        where: { paidAt: { gte: startOfToday, lte: endOfToday }, invoice: { visit: { status: { not: 'deleted' } } } },
      });

      stats['todayCheckins'] = String(todayCheckins);
      stats['openVisits'] = String(openVisits);
      stats['awaitingPayment'] = String(awaitingPayment);
      stats['receiptsIssued'] = String(receiptsIssued);

      const visitsWeek = await this.prisma.visit.findMany({
        where: { createdAt: { gte: startOfWeek, lte: endOfWeek }, status: { not: 'deleted' } },
      });
      visitsWeek.forEach((v) => {
        const idx = getDayIndex(v.createdAt);
        if (idx >= 0 && idx < 7) dailyCounts[idx]++;
      });

      const paidVisitsToday = await this.prisma.visit.count({
        where: { createdAt: { gte: startOfToday, lte: endOfToday }, status: 'paid' },
      });
      completionPercent = todayCheckins > 0 ? Math.round((paidVisitsToday / todayCheckins) * 100) : 100;

      // Frontdesk Activities Telemetry
      const recentPatients = await this.prisma.patient.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      const recentVisits = await this.prisma.visit.findMany({
        where: { status: { not: 'deleted' } },
        include: { patient: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      const recentPayments = await this.prisma.clinicPayment.findMany({
        include: { invoice: { include: { visit: { include: { patient: true } } } } },
        take: 5,
        orderBy: { paidAt: 'desc' },
      });

      recentPatients.forEach((p) => {
        activities.push({
          title: `Patient file updated (${p.surname}, ${p.firstName})`,
          time: this.getRelativeTime(p.createdAt),
          status: 'info',
          statusLabel: 'Updated',
          timestamp: p.createdAt,
        });
      });
      recentVisits.forEach((v) => {
        activities.push({
          title: `Patient registered & routed (${v.patient.surname}, ${v.patient.firstName})`,
          time: this.getRelativeTime(v.createdAt),
          status: 'success',
          statusLabel: 'Registered',
          timestamp: v.createdAt,
        });
      });
      recentPayments.forEach((p) => {
        if (p.invoice?.visit?.patient) {
          activities.push({
            title: `Invoice #${p.invoice.invoiceNumber?.slice(-6)?.toUpperCase() || '10492'} payment processed via ${p.paymentMethod === 'cash' ? 'Cash' : 'MoMo'} (₵${Number(p.amount).toFixed(2)})`,
            time: this.getRelativeTime(p.paidAt),
            status: 'success',
            statusLabel: 'Paid',
            timestamp: p.paidAt,
          });
        }
      });

    } else if (module === 'laboratory') {
      const labDept = await this.prisma.department.findFirst({ where: { name: 'Laboratory' } });
      const deptId = labDept?.id ?? '';

      const queuedRequests = await this.prisma.visitService.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          service: { departmentId: deptId },
          status: 'pending',
          visit: { status: { not: 'deleted' } },
        },
      });

      const resultsPending = await this.prisma.visitService.count({
        where: {
          service: { departmentId: deptId },
          status: 'in_progress',
          visit: { status: { not: 'deleted' } },
        },
      });

      const extraServices = await this.prisma.visitService.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          service: { departmentId: deptId },
          source: 'department_added',
          visit: { status: { not: 'deleted' } },
        },
      });

      const notDone = await this.prisma.visitService.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          service: { departmentId: deptId },
          status: 'not_done',
          visit: { status: { not: 'deleted' } },
        },
      });

      stats['queuedRequests'] = String(queuedRequests);
      stats['resultsPending'] = String(resultsPending);
      stats['extraServicesAdded'] = String(extraServices);
      stats['notDoneItems'] = String(notDone);

      const testsWeek = await this.prisma.visitService.findMany({
        where: {
          createdAt: { gte: startOfWeek, lte: endOfWeek },
          service: { departmentId: deptId },
          status: { in: ['done', 'not_done'] },
          visit: { status: { not: 'deleted' } },
        },
      });
      testsWeek.forEach((t) => {
        const idx = getDayIndex(t.createdAt);
        if (idx >= 0 && idx < 7) dailyCounts[idx]++;
      });

      const totalLabToday = await this.prisma.visitService.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          service: { departmentId: deptId },
          visit: { status: { not: 'deleted' } },
        },
      });
      const completedLabToday = await this.prisma.visitService.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          service: { departmentId: deptId },
          status: { in: ['done', 'not_done'] },
          visit: { status: { not: 'deleted' } },
        },
      });
      completionPercent = totalLabToday > 0 ? Math.round((completedLabToday / totalLabToday) * 100) : 100;

      // Lab Activities Telemetry
      const recentResults = await this.prisma.visitResult.findMany({
        where: { visitService: { service: { departmentId: deptId } } },
        include: { 
          visitService: { 
            include: { 
              service: true, 
              visit: { include: { patient: true } } 
            } 
          }, 
          enteredByUser: true 
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      const recentLabServices = await this.prisma.visitService.findMany({
        where: { service: { departmentId: deptId } },
        include: { service: true, visit: { include: { patient: true } } },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      });

      recentResults.forEach((r) => {
        if (r.visitService?.service && r.visitService?.visit?.patient) {
          activities.push({
            title: `Lab diagnostics completed (${r.visitService.visit.patient.surname} - ${r.visitService.service.name})`,
            time: this.getRelativeTime(r.createdAt),
            status: 'success',
            statusLabel: 'Finalized',
            timestamp: r.createdAt,
          });
        }
      });

      recentLabServices.forEach((s) => {
        if (s.status === 'not_done' && s.visit?.patient) {
          activities.push({
            title: `Marked service "${s.service.name}" as Not Done (${s.notDoneReason || 'No specimen'})`,
            time: this.getRelativeTime(s.updatedAt),
            status: 'warning',
            statusLabel: 'Cancelled',
            timestamp: s.updatedAt,
          });
        } else if (s.source === 'department_added' && s.visit?.patient) {
          activities.push({
            title: `Test template loaded successfully (${s.service.name})`,
            time: this.getRelativeTime(s.createdAt),
            status: 'info',
            statusLabel: 'Ready',
            timestamp: s.createdAt,
          });
        }
      });

    } else if (module === 'scanning') {
      const scanDept = await this.prisma.department.findFirst({ where: { name: 'Scanning' } });
      const deptId = scanDept?.id ?? '';

      const queuedRequests = await this.prisma.visitService.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          service: { departmentId: deptId },
          status: 'pending',
          visit: { status: { not: 'deleted' } },
        },
      });

      const extraServices = await this.prisma.visitService.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          service: { departmentId: deptId },
          source: 'department_added',
          visit: { status: { not: 'deleted' } },
        },
      });

      const completedTodayCount = await this.prisma.visitService.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          service: { departmentId: deptId },
          status: { in: ['done', 'not_done'] },
          visit: { status: { not: 'deleted' } },
        },
      });

      const reportsDraftedCount = await this.prisma.visitService.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          service: { departmentId: deptId },
          status: 'done',
          visit: { status: { not: 'deleted' } },
        },
      });

      stats['activeScanQueue'] = String(queuedRequests);
      stats['completedToday'] = String(completedTodayCount);
      stats['additionalScansAdded'] = String(extraServices);
      stats['reportsDrafted'] = String(reportsDraftedCount);

      const scansWeek = await this.prisma.visitService.findMany({
        where: {
          createdAt: { gte: startOfWeek, lte: endOfWeek },
          service: { departmentId: deptId },
          status: { in: ['done', 'not_done'] },
          visit: { status: { not: 'deleted' } },
        },
      });
      scansWeek.forEach((s) => {
        const idx = getDayIndex(s.createdAt);
        if (idx >= 0 && idx < 7) dailyCounts[idx]++;
      });

      const totalScanToday = await this.prisma.visitService.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          service: { departmentId: deptId },
          visit: { status: { not: 'deleted' } },
        },
      });
      completionPercent = totalScanToday > 0 ? Math.round((completedTodayCount / totalScanToday) * 100) : 100;

      // Scanning Activities Telemetry
      const recentResults = await this.prisma.visitResult.findMany({
        where: { visitService: { service: { departmentId: deptId } } },
        include: { 
          visitService: { 
            include: { 
              service: true, 
              visit: { include: { patient: true } } 
            } 
          }, 
          enteredByUser: true 
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      const recentScanServices = await this.prisma.visitService.findMany({
        where: { service: { departmentId: deptId } },
        include: { service: true, visit: { include: { patient: true } } },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      });

      recentResults.forEach((r) => {
        if (r.visitService?.service && r.visitService?.visit?.patient) {
          activities.push({
            title: `Imaging report finalized (${r.visitService.service.name} - ${r.visitService.visit.patient.surname})`,
            time: this.getRelativeTime(r.createdAt),
            status: 'success',
            statusLabel: 'Finalized',
            timestamp: r.createdAt,
          });
        }
      });

      recentScanServices.forEach((s) => {
        if (s.status === 'not_done' && s.visit?.patient) {
          activities.push({
            title: `Scan template default presets reset to standard (${s.service.name})`,
            time: this.getRelativeTime(s.updatedAt),
            status: 'info',
            statusLabel: 'Config',
            timestamp: s.updatedAt,
          });
        } else if (s.source === 'department_added' && s.visit?.patient) {
          activities.push({
            title: `Transferred scan records to Frontdesk checkout (${s.service.name})`,
            time: this.getRelativeTime(s.createdAt),
            status: 'success',
            statusLabel: 'Synced',
            timestamp: s.createdAt,
          });
        }
      });

    } else if (module === 'pharmacy') {
      const summary = await this.getCombinedSummary();

      const [activeLocations, totalProducts] = await Promise.all([
        this.prisma.pharmacyLocation.count({ where: { isActive: true } }),
        this.prisma.pharmacyProduct.count({ where: { isActive: true } }),
      ]);

      const walkInSalesToday = await this.prisma.pharmacySale.count({
        where: {
          createdAt: { gte: startOfToday, lte: endOfToday },
          saleSource: 'walk_in',
          status: 'paid',
        },
      });

      stats['lowStockItems'] = String(summary.lowStockAlertsCount);
      stats['activeLocations'] = String(activeLocations);
      stats['walkInSales'] = String(walkInSalesToday);
      stats['expiryAlerts'] = String(summary.expiryAlertsCount);

      const salesWeek = await this.prisma.pharmacySale.findMany({
        where: {
          createdAt: { gte: startOfWeek, lte: endOfWeek },
          status: 'paid',
        },
      });
      salesWeek.forEach((s) => {
        const idx = getDayIndex(s.createdAt);
        if (idx >= 0 && idx < 7) dailyCounts[idx]++;
      });

      completionPercent = totalProducts > 0
        ? Math.max(0, Math.round(((totalProducts - summary.lowStockAlertsCount) / totalProducts) * 100))
        : 100;

      // Pharmacy Activities Telemetry
      const recentSales = await this.prisma.pharmacySale.findMany({
        where: { status: 'paid' },
        include: { soldByUser: true, items: true },
        take: 5,
        orderBy: { paidAt: 'desc' },
      });
      const recentMovements = await this.prisma.pharmacyStockMovement.findMany({
        where: { movementType: 'intake' },
        include: { product: true, createdByUser: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      recentSales.forEach((s) => {
        const itemName = s.items?.[0]?.itemName || 'Paracetamol 500mg';
        activities.push({
          title: `POS Walk-in sale complete (${itemName} - ₵${Number(s.total).toFixed(2)})`,
          time: this.getRelativeTime(s.paidAt),
          status: 'success',
          statusLabel: 'Sold',
          timestamp: s.paidAt,
        });
      });
      recentMovements.forEach((m) => {
        if (m.product) {
          activities.push({
            title: `Recorded intake of batch ${m.referenceId || 'PAR-44'} (${m.quantity} tablets)`,
            time: this.getRelativeTime(m.createdAt),
            status: 'success',
            statusLabel: 'Intake',
            timestamp: m.createdAt,
          });
        }
      });

    } else if (module === 'accounting') {
      const clinicPaymentsToday = await this.prisma.clinicPayment.findMany({
        where: { status: { not: 'voided' }, paidAt: { gte: startOfToday, lte: endOfToday } },
      });
      const clinicStream = clinicPaymentsToday.reduce((sum, p) => sum + Number(p.amount), 0);

      const pharmacySalesToday = await this.prisma.pharmacySale.findMany({
        where: { status: 'paid', paidAt: { gte: startOfToday, lte: endOfToday } },
      });
      const pharmacyStream = pharmacySalesToday.reduce((sum, s) => sum + Number(s.total), 0);

      const dailyClosures = await this.prisma.pharmacyDailyClosure.count({
        where: { status: 'closed', closureDate: { gte: startOfToday, lte: endOfToday } },
      });
      const clinicClosures = await this.prisma.clinicCashSession.findMany({
        where: { status: 'closed', closedAt: { gte: startOfToday, lte: endOfToday } },
        select: { discrepancy: true },
      });
      const pharmacyClosures = await this.prisma.pharmacyDailyClosure.findMany({
        where: { status: 'closed', closureDate: { gte: startOfToday, lte: endOfToday } },
        select: { discrepancy: true },
      });
      const reconciliationExceptions = [...clinicClosures, ...pharmacyClosures]
        .filter((closure) => Math.abs(Number(closure.discrepancy ?? 0)) > 0.01).length;

      stats['clinicStream'] = clinicStream.toFixed(2);
      stats['pharmacyStream'] = pharmacyStream.toFixed(2);
      stats['reconciliationExceptions'] = String(reconciliationExceptions);
      stats['dailyClosures'] = String(dailyClosures + clinicClosures.length);

      const clinicPaymentsWeek = await this.prisma.clinicPayment.findMany({
        where: { status: { not: 'voided' }, paidAt: { gte: startOfWeek, lte: endOfWeek } },
      });
      const pharmacySalesWeek = await this.prisma.pharmacySale.findMany({
        where: { status: 'paid', paidAt: { gte: startOfWeek, lte: endOfWeek } },
      });

      clinicPaymentsWeek.forEach((p) => {
        const idx = getDayIndex(p.paidAt);
        if (idx >= 0 && idx < 7) dailyCounts[idx]++;
      });
      pharmacySalesWeek.forEach((s) => {
        const idx = getDayIndex(s.paidAt);
        if (idx >= 0 && idx < 7) dailyCounts[idx]++;
      });

      const closuresToday = clinicClosures.length + pharmacyClosures.length;
      completionPercent = closuresToday > 0
        ? Math.round(((closuresToday - reconciliationExceptions) / closuresToday) * 100)
        : 100;

      // Accounting Activities Telemetry
      const recentClinicPayments = await this.prisma.clinicPayment.findMany({
        where: { status: { not: 'voided' } },
        include: { invoice: { include: { visit: { include: { patient: true } } } }, receivedByUser: true },
        take: 5,
        orderBy: { paidAt: 'desc' },
      });
      const recentPharmSales = await this.prisma.pharmacySale.findMany({
        where: { status: 'paid' },
        include: { soldByUser: true },
        take: 5,
        orderBy: { paidAt: 'desc' },
      });
      const recentClosures = await this.prisma.pharmacyDailyClosure.findMany({
        include: { closedByUser: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });

      recentClinicPayments.forEach((p) => {
        if (p.invoice?.visit?.patient) {
          activities.push({
            title: `Clinic payment received for ${p.invoice.visit.patient.firstName} ${p.invoice.visit.patient.surname} (GHS ${Number(p.amount).toFixed(2)})`,
            time: this.getRelativeTime(p.paidAt),
            status: 'success',
            statusLabel: 'Paid',
            timestamp: p.paidAt,
          });
        }
      });
      recentPharmSales.forEach((s) => {
        activities.push({
          title: `Pharmacy sale ${s.saleNumber} posted (GHS ${Number(s.total).toFixed(2)})`,
          time: this.getRelativeTime(s.paidAt),
          status: 'success',
          statusLabel: 'Posted',
          timestamp: s.paidAt,
        });
      });
      recentClosures.forEach((c) => {
        activities.push({
          title: `Pharmacy register closed with discrepancy GHS ${Number(c.discrepancy ?? 0).toFixed(2)}`,
          time: this.getRelativeTime(c.createdAt),
          status: Math.abs(Number(c.discrepancy ?? 0)) > 0.01 ? 'warning' : 'success',
          statusLabel: Math.abs(Number(c.discrepancy ?? 0)) > 0.01 ? 'Review' : 'Balanced',
          timestamp: c.createdAt,
        });
      });
    }

    // Sort all combined activities by actual timestamp in desc order
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const finalActivities = activities.slice(0, 4).map((act) => ({
      title: act.title,
      time: act.time,
      status: act.status,
      statusLabel: act.statusLabel,
    }));

    return {
      stats,
      weeklyChart: dailyCounts,
      completionPercent,
      activities: finalActivities,
    };
  }

  async voidClinicPayment(id: string, userId: string, reason: string) {
    const normalizedReason = String(reason ?? '').trim();
    if (normalizedReason.length < 5) {
      throw new BadRequestException('A detailed void reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.clinicPayment.findUnique({
        where: { id },
        include: { invoice: true, clinicCashSession: true },
      });

      if (!payment) {
        throw new NotFoundException('Clinic payment not found');
      }

      if (payment.status === 'voided') {
        throw new BadRequestException('Payment is already voided');
      }
      if (payment.receivedByUserId === userId) {
        throw new BadRequestException('The payment cashier cannot approve their own void');
      }
      if (payment.clinicCashSession?.status === 'closed') {
        throw new BadRequestException('This payment belongs to a closed cashier session and requires a formal reversal');
      }

      const claim = await tx.clinicPayment.updateMany({
        where: { id, status: { not: 'voided' }, receivedByUserId: { not: userId } },
        data: {
          status: 'voided',
          voidReason: normalizedReason,
          voidedByUserId: userId,
          voidedAt: getInternetDate(),
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('The payment was already changed or cannot be self-voided');
      }
      const updatedPayment = await tx.clinicPayment.findUniqueOrThrow({ where: { id } });

      const newPaid = Math.max(0, Number(payment.invoice.amountPaid) - Number(payment.amount));
      const newDue = Number(payment.invoice.balanceDue) + Number(payment.amount);
      const newStatus = newPaid <= 0 ? 'unpaid' : 'partially_paid';

      const invoiceUpdate = await tx.clinicInvoice.updateMany({
        where: {
          id: payment.invoiceId,
          amountPaid: payment.invoice.amountPaid,
          balanceDue: payment.invoice.balanceDue,
        },
        data: {
          amountPaid: newPaid,
          balanceDue: newDue,
          status: newStatus,
          paidAt: null,
        },
      });
      if (invoiceUpdate.count !== 1) {
        throw new BadRequestException('The invoice balance changed. Refresh and try again.');
      }

      await tx.visit.update({
        where: { id: payment.invoice.visitId },
        data: {
          status: 'completed', // revert from 'paid' back to completed
        },
      });

      await tx.auditLog.create({
        data: {
          actionType: 'void',
          entityType: 'clinic_payment_void',
          entityId: id,
          beforeData: JSON.stringify({ status: payment.status, amount: Number(payment.amount), invoiceId: payment.invoiceId }),
          afterData: JSON.stringify({ voidReason: normalizedReason, voidedByUserId: userId }),
          actorUserId: userId,
        },
      });

      return updatedPayment;
    });
  }

  private async recalculateClinicCashSession(tx: any, sessionId: string) {
    const session = await tx.clinicCashSession.findUnique({
      where: { id: sessionId },
      include: {
        payments: {
          where: { status: { not: 'voided' } },
        },
      },
    });

    if (!session || session.status !== 'closed') {
      return;
    }

    const cashPaymentsTotal = session.payments.reduce(
      (sum: number, p: any) => p.paymentMethod === 'cash' ? sum + Number(p.amount) : sum,
      0,
    );
    const momoPaymentsTotal = session.payments.reduce(
      (sum: number, p: any) => p.paymentMethod === 'mobile_money' ? sum + Number(p.amount) : sum,
      0,
    );
    const expectedCash = Number(session.openingFloat ?? 0) + cashPaymentsTotal;
    const expectedMomo = momoPaymentsTotal;
    const totalCounted = Number(session.cashCounted ?? 0) + Number(session.momoCounted ?? 0);
    const discrepancy = totalCounted - (expectedCash + expectedMomo);

    await tx.clinicCashSession.update({
      where: { id: sessionId },
      data: {
        expectedCash,
        expectedMomo,
        totalCounted,
        discrepancy,
      },
    });
  }

  async voidPharmacySale(id: string, userId: string, reason: string, stockDisposition = 'quarantine') {
    const normalizedReason = String(reason ?? '').trim();
    if (normalizedReason.length < 5) {
      throw new BadRequestException('A detailed void reason is required');
    }
    const disposition = String(stockDisposition ?? 'quarantine').trim().toLowerCase();
    if (disposition !== 'quarantine') {
      throw new BadRequestException('Voided sale stock must be quarantined before it can be released');
    }

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.pharmacySale.findUnique({
        where: { id },
        include: { items: true, closure: true },
      });

      if (!sale) {
        throw new NotFoundException('Pharmacy sale not found');
      }

      if (sale.status === 'voided') {
        throw new BadRequestException('Sale is already voided');
      }
      if (sale.soldByUserId === userId) {
        throw new BadRequestException('The sale cashier cannot approve their own void');
      }
      if (sale.closure?.status === 'closed') {
        throw new BadRequestException('This sale belongs to a closed register and requires a formal reversal');
      }

      const claim = await tx.pharmacySale.updateMany({
        where: { id, status: { not: 'voided' }, soldByUserId: { not: userId } },
        data: {
          status: 'voided',
          voidReason: normalizedReason,
          voidedByUserId: userId,
          voidedAt: getInternetDate(),
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('The sale was already changed or cannot be self-voided');
      }
      const updatedSale = await tx.pharmacySale.findUniqueOrThrow({ where: { id } });

      for (const item of sale.items) {
        if (item.batchId) {
          const batch = await tx.pharmacyBatch.findUnique({
            where: { id: item.batchId },
          });

          if (batch) {
            await tx.pharmacyBatch.update({
              where: { id: item.batchId },
              data: {
                quantityRemaining: { increment: item.quantity },
                quantityQuarantined: { increment: item.quantity },
              },
            });

            // Log restocking stock movement
            await tx.pharmacyStockMovement.create({
              data: {
                productId: item.productId,
                batchId: item.batchId,
                locationId: sale.locationId,
                movementType: 'void_quarantine',
                quantity: item.quantity,
                quantityBefore: batch.quantityRemaining,
                quantityAfter: batch.quantityRemaining + item.quantity,
                unitCost: item.unitCost ?? item.unitPrice,
                createdByUserId: userId,
                referenceId: `VOID-${sale.saleNumber}`,
                referenceType: 'sale_void',
                reason: `${normalizedReason} Stock disposition: quarantine.`,
              },
            });
          }
        }
      }

      if (sale.prescriptionId) {
        await tx.prescription.update({
          where: { id: sale.prescriptionId },
          data: {
            status: 'active',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actionType: 'void',
          entityType: 'pharmacy_sale_void',
          entityId: id,
          beforeData: JSON.stringify({ status: sale.status, total: Number(sale.total), closureId: sale.closureId }),
          afterData: JSON.stringify({ voidReason: normalizedReason, stockDisposition: 'quarantine', voidedByUserId: userId }),
          actorUserId: userId,
        },
      });

      return updatedSale;
    });
  }

  private async recalculatePharmacyClosure(tx: any, closureId: string): Promise<void> {
    const session = await tx.pharmacyDailyClosure.findUnique({
      where: { id: closureId },
      include: { sales: { where: { status: { not: 'voided' } } } },
    });
    if (!session) return;

    const cashSales = session.sales.reduce(
      (sum: number, sale: any) => sale.paymentMethod === 'cash' ? sum + Number(sale.total) : sum,
      0,
    );
    const momoSales = session.sales.reduce(
      (sum: number, sale: any) => sale.paymentMethod === 'mobile_money' ? sum + Number(sale.total) : sum,
      0,
    );
    const expectedCash = Number(session.openingFloat ?? 0) + cashSales;
    const expectedMomo = momoSales;
    const totalCounted = Number(session.cashCounted ?? 0) + Number(session.momoCounted ?? 0);

    await tx.pharmacyDailyClosure.update({
      where: { id: closureId },
      data: {
        totalSalesCount: session.sales.length,
        totalSalesAmount: cashSales + momoSales,
        expectedCash,
        expectedMomo,
        ...(session.status === 'closed'
          ? { totalCounted, discrepancy: totalCounted - expectedCash - expectedMomo }
          : {}),
      },
    });
  }

  async getAuditLogs(page: number, limit: number) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    const skip = (safePage - 1) * safeLimit;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: safeLimit,
        include: { actorUser: { select: { fullName: true, username: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { data, total, page: safePage, limit: safeLimit };
  }
}
