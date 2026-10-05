import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getInternetDate } from '../common/clock';
import { buildDateRange } from '../common/date-range';
import { ensurePositiveMoney, formatMoney } from '../common/money';
import { assertAccountingDateOpen, assertNoFinancialReversal } from '../common/accounting-period';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async createExpense(data: any, userId: string) {
    const { title, category, amount, notes, expenseDate } = data;

    if (!title || !category || amount === undefined) {
      throw new BadRequestException('Title, category, and amount are required');
    }

    const expenseAmount = ensurePositiveMoney(amount, 'Expense amount');

    const validCategories = ['rent', 'utilities', 'salaries', 'maintenance', 'transport', 'professional_fees', 'inventory', 'other'];
    if (!validCategories.includes(category)) {
      throw new BadRequestException(`Category must be one of: ${validCategories.join(', ')}`);
    }

    const paymentMethod = data.paymentMethod ? String(data.paymentMethod).trim().toLowerCase() : null;
    if (paymentMethod && !['cash', 'mobile_money', 'bank_transfer', 'cheque', 'other'].includes(paymentMethod)) {
      throw new BadRequestException('Select a valid payment method');
    }
    const referenceNumber = data.referenceNumber ? String(data.referenceNumber).trim() : null;
    if (paymentMethod && paymentMethod !== 'cash' && !referenceNumber) {
      throw new BadRequestException('A reference number is required for non-cash expenses');
    }

    return this.prisma.$transaction(async (tx) => {
      await assertAccountingDateOpen(tx, expenseDate ? new Date(expenseDate) : getInternetDate());
      const expense = await tx.expense.create({
        data: {
        title: String(title).trim(),
        category,
        amount: expenseAmount,
        payee: data.payee ? String(data.payee).trim() : null,
        paymentMethod,
        referenceNumber,
        costCenter: data.costCenter ? String(data.costCenter).trim() : null,
        attachmentUrl: data.attachmentUrl ? String(data.attachmentUrl).trim() : null,
        notes: notes || null,
        expenseDate: expenseDate ? new Date(expenseDate) : getInternetDate(),
        createdById: userId,
        status: 'posted',
        },
      });
      await tx.auditLog.create({
        data: {
          actionType: 'create',
          entityType: 'expense',
          entityId: expense.id,
          afterData: JSON.stringify({ title: expense.title, category: expense.category, amount: formatMoney(expense.amount) }),
          actorUserId: userId,
        },
      });
      return expense;
    });
  }

  async findAllExpenses(startDate?: string, endDate?: string, page: number = 1, limit: number = 10) {
    const where: any = {
      expenseDate: buildDateRange(startDate, endDate, { defaultDays: 31, maxDays: 366 }),
    };

    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 10;
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          reversals: { where: { status: { in: ['pending', 'approved'] } }, select: { status: true, postedAt: true } },
          createdByUser: {
            select: { fullName: true, username: true },
          },
          voidedByUser: {
            select: { fullName: true, username: true },
          },
        },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async voidExpense(id: string, userId: string, reason: string) {
    const normalizedReason = String(reason ?? '').trim();
    if (normalizedReason.length < 5) {
      throw new BadRequestException('A detailed void reason is required');
    }
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { supplierPayment: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    if (expense.supplierPayment || expense.category === 'supplier_payment') {
      throw new BadRequestException('Supplier payment expenses are controlled from Supplier Payables and cannot be deleted here');
    }

    if (expense.status === 'voided') {
      throw new BadRequestException('Expense is already voided');
    }
    if (expense.createdById === userId) {
      throw new BadRequestException('The expense creator cannot approve their own void');
    }

    return this.prisma.$transaction(async (tx) => {
      await assertAccountingDateOpen(tx, expense.expenseDate);
      await assertNoFinancialReversal(tx, 'expense', id);
      const claim = await tx.expense.updateMany({
        where: { id, status: { not: 'voided' }, createdById: { not: userId } },
        data: {
          status: 'voided',
          voidReason: normalizedReason,
          voidedAt: getInternetDate(),
          voidedByUserId: userId,
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('The expense was already changed or cannot be self-voided');
      }
      const updated = await tx.expense.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({
        data: {
          actionType: 'void',
          entityType: 'expense',
          entityId: id,
          beforeData: JSON.stringify({ status: expense.status, amount: formatMoney(expense.amount) }),
          afterData: JSON.stringify({ status: 'voided', reason: normalizedReason }),
          actorUserId: userId,
        },
      });
      return updated;
    });
  }
}
