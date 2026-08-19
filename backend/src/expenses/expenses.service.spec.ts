import { BadRequestException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  it('voids an expense and records an audit entry instead of deleting it', async () => {
    const expense = { id: 'expense-1', status: 'posted', category: 'utilities', amount: 120, supplierPayment: null, createdById: 'user-2' };
    const tx = {
      expense: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...expense, status: 'voided' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      expense: { findUnique: jest.fn().mockResolvedValue(expense) },
      $transaction: jest.fn((callback) => callback(tx)),
    } as any;
    const service = new ExpensesService(prisma);

    const result = await service.voidExpense('expense-1', 'user-1', 'Duplicate utility bill');

    expect(result.status).toBe('voided');
    expect(tx.expense.updateMany).toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it('prevents supplier-payment expenses from being voided outside payables', async () => {
    const prisma = {
      expense: { findUnique: jest.fn().mockResolvedValue({ id: 'expense-2', status: 'posted', category: 'supplier_payment', supplierPayment: {} }) },
    } as any;
    const service = new ExpensesService(prisma);
    await expect(service.voidExpense('expense-2', 'user-1', 'Incorrect supplier settlement')).rejects.toBeInstanceOf(BadRequestException);
  });
});
