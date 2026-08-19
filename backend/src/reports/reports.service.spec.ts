import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

describe('ReportsService financial summary', () => {
  it('uses sold-item cost for profit and keeps inventory purchases separate', async () => {
    const prisma = {
      clinicPayment: { findMany: jest.fn().mockResolvedValue([{ amount: 500, paymentMethod: 'cash', paidAt: new Date() }]) },
      pharmacySale: { findMany: jest.fn().mockResolvedValue([{
        total: 300,
        paymentMethod: 'mobile_money',
        paidAt: new Date(),
        items: [{ quantity: 2, unitCost: 75 }],
      }]) },
      expense: { findMany: jest.fn().mockResolvedValue([{ category: 'utilities', amount: 50 }]) },
      pharmacyGoodsReceipt: { findMany: jest.fn().mockResolvedValue([{ totalCost: 1000 }]) },
      pharmacyPurchaseReturn: { findMany: jest.fn().mockResolvedValue([{ totalCredit: 100 }]) },
      pharmacySupplierPayment: { findMany: jest.fn().mockResolvedValue([{ amount: 400 }]) },
      pharmacyLocationProduct: { findMany: jest.fn().mockResolvedValue([]) },
      pharmacyBatch: { findMany: jest.fn().mockResolvedValue([]) },
      clinicCashSession: { findMany: jest.fn().mockResolvedValue([]) },
      pharmacyDailyClosure: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const service = new ReportsService(prisma);

    const result = await service.getCombinedSummary();

    expect(result.pharmacyCogs).toBe(150);
    expect(result.pharmacyGrossProfit).toBe(150);
    expect(result.netInventoryPurchases).toBe(900);
    expect(result.operatingExpensesTotal).toBe(50);
    expect(result.estimatedOperatingResult).toBe(600);
    expect(result.cashOutflowsTotal).toBe(450);
    expect(prisma.clinicPayment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { amount: true, paymentMethod: true, paidAt: true },
    }));
  });
});

describe('ReportsService void controls', () => {
  it('does not rewrite a payment from a closed cashier session', async () => {
    const tx = {
      clinicPayment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1', status: 'paid', receivedByUserId: 'cashier', clinicCashSession: { status: 'closed' }, invoice: {},
        }),
        updateMany: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new ReportsService(prisma);

    await expect(service.voidClinicPayment('payment-1', 'reviewer', 'Incorrect payment')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.clinicPayment.updateMany).not.toHaveBeenCalled();
  });

  it('does not restock when another request already voided a sale', async () => {
    const tx = {
      pharmacySale: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sale-1', status: 'paid', soldByUserId: 'cashier', closure: { status: 'open' }, items: [] }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      pharmacyBatch: { update: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new ReportsService(prisma);

    await expect(service.voidPharmacySale('sale-1', 'reviewer', 'Duplicate transaction')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.pharmacyBatch.update).not.toHaveBeenCalled();
  });
});
