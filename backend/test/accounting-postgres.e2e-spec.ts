import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountingService } from '../src/accounting/accounting.service';
import { ExpensesService } from '../src/expenses/expenses.service';
import { ReportsService } from '../src/reports/reports.service';
import { TenantContextService } from '../src/common/multitenancy/tenant-context.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const postgresTests = databaseUrl ? describe : describe.skip;

postgresTests('Accounting controls on disposable PostgreSQL', () => {
  let prisma: PrismaService;
  let accounting: AccountingService;
  let expenses: ExpensesService;
  let reports: ReportsService;
  let tenantId: string;
  let makerId: string;
  let requesterId: string;
  let reviewerId: string;
  const originalDate = new Date(Date.now() - 30 * 86400000);
  const originalDay = originalDate.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const scoped = <Result>(handler: () => Result) =>
    TenantContextService.run({ tenantId }, async () => await handler());

  beforeAll(async () => {
    const target = new URL(databaseUrl!);
    if (
      !['127.0.0.1', 'localhost'].includes(target.hostname) ||
      !target.pathname.endsWith('_test')
    ) {
      throw new Error(
        'TEST_DATABASE_URL must point to a disposable localhost database ending in _test.',
      );
    }
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query(
        'DROP TABLE IF EXISTS "FinancialReversal", "AccountingPeriod" CASCADE',
      );
      await pool.query(
        readFileSync(
          join(
            __dirname,
            '../prisma/migrations/20261005150000_accounting_period_locks_and_reversals/migration.sql',
          ),
          'utf8',
        ),
      );
    } finally {
      await pool.end();
    }
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    accounting = new AccountingService(prisma);
    expenses = new ExpensesService(prisma);
    reports = new ReportsService(prisma);
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    makerId = randomUUID();
    requesterId = randomUUID();
    reviewerId = randomUUID();
    await TenantContextService.runUnscoped(
      async () =>
        await prisma.tenant.create({
          data: { id: tenantId, name: tenantId, slug: tenantId },
        }),
    );
    await scoped(() =>
      prisma.user.createMany({
        data: [makerId, requesterId, reviewerId].map((id) => ({
          id,
          tenantId,
          fullName: id,
          email: `${id}@example.test`,
          passwordHash: 'test-only',
          role: 0,
        })),
      }),
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  const expense = (expenseDate = originalDate) =>
    scoped(() =>
      prisma.expense.create({
        data: {
          title: 'Utility payment',
          category: 'utilities',
          amount: 120,
          expenseDate,
          createdById: makerId,
        },
      }),
    );
  const lock = () =>
    scoped(() =>
      accounting.lockPeriod(
        {
          startDate: originalDay,
          endDate: originalDay,
          reason: 'Month-end reviewed',
        },
        reviewerId,
      ),
    );
  const request = (entityType: string, entityId: string) =>
    scoped(() =>
      accounting.requestReversal(
        { entityType, entityId, reason: 'Duplicate posting correction' },
        requesterId,
      ),
    );

  it('locks completed periods and rejects overlap, invalid dates, and current dates', async () => {
    await lock();
    await expect(lock()).rejects.toBeInstanceOf(ConflictException);
    await expect(
      scoped(() =>
        accounting.lockPeriod(
          { startDate: today, endDate: today, reason: 'Current day closing' },
          reviewerId,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      scoped(() =>
        accounting.lockPeriod(
          {
            startDate: '2026-02-30',
            endDate: originalDay,
            reason: 'Invalid date closing',
          },
          reviewerId,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires old open shifts to close before a period lock', async () => {
    await scoped(() =>
      prisma.clinicCashSession.create({
        data: {
          openedByUserId: makerId,
          openingFloat: 10,
          openedAt: originalDate,
        },
      }),
    );
    await expect(lock()).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks backdated expense posting and direct changes in a locked period', async () => {
    const record = await expense();
    await lock();
    await expect(
      scoped(() =>
        expenses.createExpense(
          {
            title: 'Late expense',
            category: 'utilities',
            amount: 25,
            expenseDate: originalDay,
          },
          makerId,
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      scoped(() =>
        prisma.expense.update({
          where: { id: record.id },
          data: { expenseDate: new Date(), amount: 1 },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      scoped(() => prisma.expense.delete({ where: { id: record.id } })),
    ).rejects.toThrow();
  });

  it('posts expense reversal today and leaves historical reports and original entry intact', async () => {
    const record = await expense();
    await lock();
    const reversal = await request('expense', record.id);
    const approved = await scoped(() =>
      accounting.reviewReversal(reversal.id, reviewerId, true),
    );
    expect(approved.status).toBe('approved');
    expect(approved.postedAt?.toISOString().slice(0, 10)).toBe(today);
    expect(
      (
        await scoped(() =>
          prisma.expense.findFirstOrThrow({ where: { id: record.id } }),
        )
      ).status,
    ).toBe('posted');
    expect(
      (await scoped(() => reports.getCombinedSummary(originalDay, originalDay)))
        .operatingExpensesTotal,
    ).toBe(120);
    expect(
      (await scoped(() => reports.getCombinedSummary(today, today)))
        .operatingExpensesTotal,
    ).toBe(-120);
  });

  it('rejects requester and original-maker approval and prevents duplicate requests', async () => {
    const record = await expense();
    const reversal = await request('expense', record.id);
    await expect(request('expense', record.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      scoped(() => accounting.reviewReversal(reversal.id, requesterId, true)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      scoped(() => accounting.reviewReversal(reversal.id, makerId, true)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks voiding with a pending reversal and allows rejection followed by a new request', async () => {
    const record = await expense(new Date());
    const reversal = await request('expense', record.id);
    await expect(
      scoped(() =>
        expenses.voidExpense(record.id, reviewerId, 'Duplicate payment entry'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await scoped(() =>
      accounting.reviewReversal(
        reversal.id,
        reviewerId,
        false,
        'Evidence does not match',
      ),
    );
    expect((await request('expense', record.id)).status).toBe('pending');
    await expect(
      scoped(() =>
        prisma.financialReversal.update({
          where: { id: reversal.id },
          data: { status: 'pending' },
        }),
      ),
    ).rejects.toThrow();
  });

  it('prevents tenant crossover in source selection and lists', async () => {
    const record = await expense();
    await lock();
    const otherTenant = randomUUID();
    await TenantContextService.runUnscoped(
      async () =>
        await prisma.tenant.create({
          data: { id: otherTenant, name: otherTenant, slug: otherTenant },
        }),
    );
    await expect(
      TenantContextService.run({ tenantId: otherTenant }, () =>
        accounting.requestReversal(
          {
            entityType: 'expense',
            entityId: record.id,
            reason: 'Attempt another tenant',
          },
          requesterId,
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      (
        await TenantContextService.run({ tenantId: otherTenant }, () =>
          accounting.listPeriods(),
        )
      ).total,
    ).toBe(0);
    await expect(prisma.accountingPeriod.findMany()).rejects.toThrow(
      'Tenant context is required',
    );
  });

  it('rejects forged reversal amounts and altered request evidence at the database boundary', async () => {
    const record = await expense();
    const reversal = await request('expense', record.id);
    await expect(
      scoped(() =>
        prisma.financialReversal.update({
          where: { id: reversal.id },
          data: { amount: 1, sourceDate: new Date() },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      scoped(() =>
        prisma.expense.update({
          where: { id: record.id },
          data: { status: 'voided' },
        }),
      ),
    ).rejects.toThrow();
    await scoped(() =>
      accounting.reviewReversal(
        reversal.id,
        reviewerId,
        false,
        'Invalid supporting evidence',
      ),
    );
    await expect(
      scoped(() =>
        prisma.financialReversal.create({
          data: {
            tenantId,
            entityType: 'expense',
            entityId: record.id,
            expenseId: record.id,
            amount: 1,
            sourceDate: originalDate,
            reason: 'Forged reversal amount',
            requestedByUserId: requesterId,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('serializes competing requests and keeps one pending reversal per original entry', async () => {
    const record = await expense();
    const results = await scoped(() =>
      Promise.allSettled([
        accounting.requestReversal(
          {
            entityType: 'expense',
            entityId: record.id,
            reason: 'Duplicate posting correction',
          },
          requesterId,
        ),
        accounting.requestReversal(
          {
            entityType: 'expense',
            entityId: record.id,
            reason: 'Duplicate posting correction',
          },
          reviewerId,
        ),
      ]),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      await scoped(() =>
        prisma.financialReversal.count({
          where: { entityId: record.id, status: 'pending' },
        }),
      ),
    ).toBe(1);
  });

  it('reverses a closed clinic receipt once without rewriting the closure', async () => {
    const patient = await scoped(() =>
      prisma.patient.create({
        data: {
          patientCode: randomUUID(),
          surname: 'Test',
          firstName: 'Patient',
          sex: 'male',
          age: 30,
          phone: '000',
          referralCenter: 'Walk-in',
          insuranceStatus: 'none',
        },
      }),
    );
    const visit = await scoped(() =>
      prisma.visit.create({
        data: {
          patientId: patient.id,
          visitNumber: randomUUID(),
          frontdeskUserId: makerId,
          status: 'paid',
        },
      }),
    );
    const invoice = await scoped(() =>
      prisma.clinicInvoice.create({
        data: {
          visitId: visit.id,
          invoiceNumber: randomUUID(),
          subtotal: 600,
          total: 600,
          amountPaid: 600,
          balanceDue: 0,
          status: 'paid',
        },
      }),
    );
    const session = await scoped(() =>
      prisma.clinicCashSession.create({
        data: {
          openedByUserId: makerId,
          openingFloat: 10,
          openedAt: originalDate,
          closedAt: originalDate,
          status: 'closed',
          expectedCash: 610,
          expectedMomo: 0,
          totalCounted: 610,
          discrepancy: 0,
        },
      }),
    );
    const payment = await scoped(() =>
      prisma.clinicPayment.create({
        data: {
          invoiceId: invoice.id,
          receivedByUserId: makerId,
          clinicCashSessionId: session.id,
          amount: 600,
          paymentMethod: 'cash',
          paidAt: originalDate,
        },
      }),
    );
    await lock();
    const reversal = await request('clinic', payment.id);
    const results = await scoped(() =>
      Promise.allSettled([
        accounting.reviewReversal(reversal.id, reviewerId, true),
        accounting.reviewReversal(reversal.id, reviewerId, true),
      ]),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const currentInvoice = await scoped(() =>
      prisma.clinicInvoice.findFirstOrThrow({ where: { id: invoice.id } }),
    );
    expect(Number(currentInvoice.balanceDue)).toBe(600);
    expect(Number(currentInvoice.amountPaid)).toBe(0);
    const closure = await scoped(() =>
      prisma.clinicCashSession.findFirstOrThrow({ where: { id: session.id } }),
    );
    expect(Number(closure.expectedCash)).toBe(610);
    expect(Number(closure.discrepancy)).toBe(0);
    expect(
      (await scoped(() => reports.getCombinedSummary(today, today)))
        .clinicTotal,
    ).toBe(-600);
    expect(
      (await scoped(() => reports.getCombinedSummary(originalDay, originalDay)))
        .clinicTotal,
    ).toBe(600);
  });

  it('returns reversed pharmacy stock to quarantine exactly once', async () => {
    const location = await scoped(() =>
      prisma.pharmacyLocation.create({
        data: { tenantId, code: 'MAIN', name: 'Main Pharmacy' },
      }),
    );
    const product = await scoped(() =>
      prisma.pharmacyProduct.create({
        data: { name: 'Test medicine', unitOfMeasure: 'tablet' },
      }),
    );
    const batch = await scoped(() =>
      prisma.pharmacyBatch.create({
        data: {
          productId: product.id,
          locationId: location.id,
          batchNumber: randomUUID(),
          expiryDate: new Date('2030-01-01'),
          purchasePrice: 2,
          sellingPrice: 3,
          quantityReceived: 10,
          quantityRemaining: 8,
        },
      }),
    );
    const closure = await scoped(() =>
      prisma.pharmacyDailyClosure.create({
        data: {
          openedByUserId: makerId,
          locationId: location.id,
          status: 'closed',
          createdAt: originalDate,
          closureDate: originalDate,
          expectedCash: 6,
          discrepancy: 0,
        },
      }),
    );
    const sale = await scoped(() =>
      prisma.pharmacySale.create({
        data: {
          saleNumber: randomUUID(),
          subtotal: 6,
          total: 6,
          soldByUserId: makerId,
          locationId: location.id,
          closureId: closure.id,
          paidAt: originalDate,
          paymentMethod: 'cash',
        },
      }),
    );
    await scoped(() =>
      prisma.pharmacySaleItem.create({
        data: {
          saleId: sale.id,
          productId: product.id,
          batchId: batch.id,
          locationId: location.id,
          itemName: product.name,
          quantity: 2,
          unitPrice: 3,
          unitCost: 2,
          lineTotal: 6,
        },
      }),
    );
    await lock();
    const reversal = await request('pharmacy', sale.id);
    await scoped(() =>
      accounting.reviewReversal(reversal.id, reviewerId, true),
    );
    await expect(
      scoped(() => accounting.reviewReversal(reversal.id, reviewerId, true)),
    ).rejects.toBeInstanceOf(ConflictException);
    const updated = await scoped(() =>
      prisma.pharmacyBatch.findFirstOrThrow({ where: { id: batch.id } }),
    );
    expect(updated.quantityRemaining).toBe(10);
    expect(updated.quantityQuarantined).toBe(2);
    expect(
      await scoped(() =>
        prisma.pharmacyStockMovement.count({
          where: { referenceId: reversal.id },
        }),
      ),
    ).toBe(1);
    const summary = await scoped(() =>
      reports.getCombinedSummary(today, today, location.id),
    );
    expect(summary.pharmacyTotal).toBe(-6);
    expect(summary.pharmacyCogs).toBe(-4);
    expect(
      (
        await scoped(() =>
          prisma.pharmacyDailyClosure.findFirstOrThrow({
            where: { id: closure.id },
          }),
        )
      ).expectedCash?.toNumber(),
    ).toBe(6);
  });
});
