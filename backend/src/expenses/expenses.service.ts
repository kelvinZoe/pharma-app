import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async createExpense(data: any, userId: string) {
    const { title, category, amount, notes, expenseDate } = data;

    if (!title || !category || amount === undefined) {
      throw new BadRequestException('Title, category, and amount are required');
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new BadRequestException('Amount must be a valid positive number');
    }

    const validCategories = ['rent', 'utilities', 'salaries', 'inventory', 'other'];
    if (!validCategories.includes(category)) {
      throw new BadRequestException(`Category must be one of: ${validCategories.join(', ')}`);
    }

    return this.prisma.expense.create({
      data: {
        title,
        category,
        amount: numAmount,
        notes: notes || null,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        createdById: userId,
      },
    });
  }

  async findAllExpenses(startDate?: string, endDate?: string, page: number = 1, limit: number = 10) {
    const where: any = {};
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) {
        where.expenseDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.expenseDate.lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          createdByUser: {
            select: { fullName: true, username: true },
          },
        },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async deleteExpense(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      throw new BadRequestException('Expense not found');
    }

    return this.prisma.expense.delete({
      where: { id },
    });
  }
}
