import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { IdempotencyService } from '../src/common/idempotency.service';
import { TenantContextService } from '../src/common/multitenancy/tenant-context.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PharmacyService } from '../src/pharmacy/pharmacy.service';
import { PharmacyPayablesService } from '../src/pharmacy/pharmacy-payables.service';
import { BillingService } from '../src/billing/billing.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const postgresTests = databaseUrl ? describe : describe.skip;

postgresTests('Atomic request recovery on disposable PostgreSQL', () => {
  let prisma: PrismaService;
  let pool: Pool;
  let service: IdempotencyService;
  let tenantId: string;
  let userId: string;
  let key: string;
  const scoped = <Result>(handler: () => Result) =>
    TenantContextService.run({ tenantId }, async () => await handler());
  const run = (handler: () => Promise<any>, payload: any = { amount: 20 }) =>
    scoped(() => service.run(key, 'test_payment', userId, payload, handler));
  const post = () =>
    prisma.$transaction(async (tx) => {
      const payment = await tx.expense.create({
        data: {
          title: 'Recovery test',
          category: 'test',
          amount: 20,
          createdById: userId,
        },
      });
      const visible = await prisma.expense.findUnique({
        where: { id: payment.id },
      });
      expect(visible?.id).toBe(payment.id);
      return { id: payment.id, amount: payment.amount.toString() };
    });

  beforeAll(async () => {
    const target = new URL(databaseUrl!);
    if (
      !['127.0.0.1', 'localhost'].includes(target.hostname) ||
      !target.pathname.endsWith('_test')
    )
      throw new Error('Use a disposable localhost database ending in _test.');
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(
      readFileSync(
        join(
          __dirname,
          '../prisma/migrations/20261005120000_add_idempotency_records/migration.sql',
        ),
        'utf8',
      ),
    );
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new IdempotencyService(prisma);
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    userId = randomUUID();
    key = randomUUID();
    await TenantContextService.runUnscoped(
      async () =>
        await prisma.tenant.create({
          data: { id: tenantId, name: tenantId, slug: tenantId },
        }),
    );
    await scoped(() =>
      prisma.user.create({
        data: {
          id: userId,
          fullName: 'Test cashier',
          email: `${userId}@example.test`,
          passwordHash: 'test-only',
          role: 0,
        },
      }),
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await pool?.end();
  });

  it('replays the original receipt after a lost response without reposting payment', async () => {
    const handler = jest.fn(post);
    const original = await run(handler);
    expect(await run(handler)).toEqual(original);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await scoped(() => prisma.expense.count())).toBe(1);
    expect(
      await scoped(() =>
        prisma.idempotencyRecord.count({ where: { status: 'completed' } }),
      ),
    ).toBe(1);
  });

  it('rolls back business writes and the request journal if receipt persistence fails', async () => {
    await pool.query(
      `CREATE OR REPLACE FUNCTION test_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."operation" = 'test_receipt_failure' AND NEW."status" = 'completed' THEN RAISE EXCEPTION 'simulated receipt persistence failure'; END IF; RETURN NEW; END $$`,
    );
    await pool.query(
      'CREATE TRIGGER test_receipt_failure BEFORE UPDATE ON "IdempotencyRecord" FOR EACH ROW EXECUTE FUNCTION test_receipt_failure()',
    );
    try {
      await expect(
        scoped(() =>
          service.run(
            key,
            'test_receipt_failure',
            userId,
            { amount: 20 },
            post,
          ),
        ),
      ).rejects.toThrow();
      expect(await scoped(() => prisma.expense.count())).toBe(0);
      expect(await scoped(() => prisma.idempotencyRecord.count())).toBe(0);
    } finally {
      await pool.query(
        'DROP TRIGGER test_receipt_failure ON "IdempotencyRecord"',
      );
      await pool.query('DROP FUNCTION test_receipt_failure()');
    }
    await run(post);
    expect(await scoped(() => prisma.expense.count())).toBe(1);
  });

  it('confirms rollback on a rejected payment and permits a corrected request', async () => {
    await expect(
      run(async () => {
        await post();
        throw new BadRequestException('Invalid payment');
      }),
    ).rejects.toMatchObject({ response: { requestOutcome: 'not_committed' } });
    expect(await scoped(() => prisma.expense.count())).toBe(0);
    expect(await scoped(() => prisma.idempotencyRecord.count())).toBe(0);
    await run(post, { amount: 30 });
    expect(await scoped(() => prisma.expense.count())).toBe(1);
  });

  it('does not execute a concurrent duplicate while the original is in progress', async () => {
    let signalStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = run(async () => {
      signalStarted();
      await gate;
      return post();
    });
    await started;
    const duplicate = jest.fn(post);
    try {
      await expect(run(duplicate)).rejects.toMatchObject({
        response: { code: 'REQUEST_IN_PROGRESS' },
      });
      expect(duplicate).not.toHaveBeenCalled();
    } finally {
      release();
    }
    const receipt = await original;
    expect(await run(duplicate)).toEqual(receipt);
    expect(await scoped(() => prisma.expense.count())).toBe(1);
  });

  it('continues to replay completed requests after their former expiry time', async () => {
    const original = await run(post);
    await scoped(() =>
      prisma.idempotencyRecord.updateMany({ data: { expiresAt: new Date(0) } }),
    );
    const duplicate = jest.fn(post);
    expect(await run(duplicate)).toEqual(original);
    expect(duplicate).not.toHaveBeenCalled();
  });

  it('persists and replays a null result without executing the command twice', async () => {
    const handler = jest.fn(async () => null);
    expect(await run(handler)).toBeNull();
    expect(await run(handler)).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects edited payloads and uncertain legacy records without a safe-to-retry marker', async () => {
    await run(post);
    await expect(run(post, { amount: 40 })).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' },
    });
    await scoped(() =>
      prisma.idempotencyRecord.updateMany({ data: { status: 'failed' } }),
    );
    await expect(run(post)).rejects.toMatchObject({
      response: { code: 'REQUEST_OUTCOME_UNCONFIRMED' },
    });
    expect(await scoped(() => prisma.expense.count())).toBe(1);
  });

  it('isolates replay keys between tenants', async () => {
    const firstTenant = tenantId;
    const first = await run(post);
    tenantId = randomUUID();
    await TenantContextService.runUnscoped(
      async () =>
        await prisma.tenant.create({
          data: { id: tenantId, name: tenantId, slug: tenantId },
        }),
    );
    const second = await run(async () => ({ id: 'other-tenant-receipt' }));
    expect(second).not.toEqual(first);
    expect(
      await scoped(() =>
        prisma.expense.findUnique({ where: { id: first.id } }),
      ),
    ).toBeNull();
    tenantId = firstTenant;
    expect(await run(post)).toEqual(first);
  });

  it('emits notifications only after commit, never after rollback or replay', async () => {
    const gateway = { emitNotification: jest.fn() };
    const notifications = new NotificationsService(prisma, gateway as any);
    await expect(
      run(async () => {
        await notifications.create({
          title: 'Payment',
          message: 'Received',
          targetUserId: userId,
        });
        expect(gateway.emitNotification).not.toHaveBeenCalled();
        throw new BadRequestException('Rejected');
      }),
    ).rejects.toThrow();
    expect(gateway.emitNotification).not.toHaveBeenCalled();
    expect(await scoped(() => prisma.notification.count())).toBe(0);
    const handler = async () => {
      await notifications.create({
        title: 'Payment',
        message: 'Received',
        targetUserId: userId,
      });
      expect(gateway.emitNotification).not.toHaveBeenCalled();
      return post();
    };
    await run(handler);
    await run(handler);
    expect(gateway.emitNotification).toHaveBeenCalledTimes(1);
  });

  it('does not turn a committed receipt into an error when socket emission fails', async () => {
    const gateway = {
      emitNotification: jest.fn(() => {
        throw new Error('Socket unavailable');
      }),
    };
    const notifications = new NotificationsService(prisma, gateway as any);
    const receipt = await run(async () => {
      await notifications.create({
        title: 'Payment',
        message: 'Received',
        targetUserId: userId,
      });
      return post();
    });
    expect(await run(post)).toEqual(receipt);
    expect(await scoped(() => prisma.expense.count())).toBe(1);
  });

  it('recovers a real POS receipt after stock, price and register state have changed', async () => {
    const notifications = new NotificationsService(prisma, {
      emitNotification: jest.fn(),
    } as any);
    const pharmacy = new PharmacyService(
      prisma,
      notifications,
      new PharmacyPayablesService(prisma),
    );
    const location = await scoped(() =>
      prisma.pharmacyLocation.create({
        data: { code: 'MAIN', name: 'Main pharmacy', tenantId },
      }),
    );
    const product = await scoped(() =>
      prisma.pharmacyProduct.create({
        data: { name: 'Test medicine', unitOfMeasure: 'tablet' },
      }),
    );
    await scoped(() =>
      prisma.pharmacyLocationProduct.create({
        data: {
          tenantId,
          locationId: location.id,
          productId: product.id,
          defaultSellingPrice: 3,
        },
      }),
    );
    const batch = await scoped(() =>
      prisma.pharmacyBatch.create({
        data: {
          productId: product.id,
          locationId: location.id,
          batchNumber: 'B-001',
          expiryDate: new Date('2030-01-01'),
          purchasePrice: 1,
          sellingPrice: 3,
          quantityReceived: 10,
          quantityRemaining: 10,
        },
      }),
    );
    const register = await scoped(() =>
      prisma.pharmacyDailyClosure.create({
        data: { openedByUserId: userId, locationId: location.id },
      }),
    );
    const payload = {
      paymentMethod: 'cash',
      items: [{ productId: product.id, quantity: 2 }],
    };
    const checkout = () =>
      scoped(() =>
        service.run(
          key,
          'pharmacy_sale',
          userId,
          { locationId: location.id, body: payload },
          () => pharmacy.processSale(payload, userId, location.id),
        ),
      );
    const original = await checkout();
    await scoped(() =>
      prisma.pharmacyDailyClosure.update({
        where: { id: register.id },
        data: { status: 'closed' },
      }),
    );
    await scoped(() =>
      prisma.pharmacyLocationProduct.updateMany({
        data: { defaultSellingPrice: 9 },
      }),
    );
    const recovered = await checkout();
    expect(recovered.id).toBe(original.id);
    expect(Number(recovered.total)).toBe(6);
    expect(await scoped(() => prisma.pharmacySale.count())).toBe(1);
    expect(
      (
        await scoped(() =>
          prisma.pharmacyBatch.findUniqueOrThrow({ where: { id: batch.id } }),
        )
      ).quantityRemaining,
    ).toBe(8);
    expect(await scoped(() => prisma.pharmacyStockMovement.count())).toBe(1);
    expect(
      await scoped(() =>
        prisma.auditLog.count({ where: { entityType: 'sale' } }),
      ),
    ).toBe(1);
  });

  it('recovers a clinic payment after the invoice is fully paid and the cashier session is closed', async () => {
    const notifications = new NotificationsService(prisma, {
      emitNotification: jest.fn(),
    } as any);
    const billing = new BillingService(prisma, notifications);
    const patient = await scoped(() =>
      prisma.patient.create({
        data: {
          patientCode: 'PAT-1',
          surname: 'Test',
          firstName: 'Patient',
          sex: 'male',
          age: 30,
          phone: '0000',
          referralCenter: 'Self',
          insuranceStatus: 'none',
        },
      }),
    );
    const department = await scoped(() =>
      prisma.department.create({ data: { name: 'Laboratory', code: 'LAB' } }),
    );
    const procedure = await scoped(() =>
      prisma.service.create({
        data: { name: 'Test', price: 20, departmentId: department.id },
      }),
    );
    const visit = await scoped(() =>
      prisma.visit.create({
        data: {
          visitNumber: 'VIS-1',
          patientId: patient.id,
          frontdeskUserId: userId,
        },
      }),
    );
    await scoped(() =>
      prisma.visitService.create({
        data: {
          visitId: visit.id,
          serviceId: procedure.id,
          unitPrice: 20,
          lineTotal: 20,
          status: 'done',
        },
      }),
    );
    await scoped(() =>
      prisma.clinicInvoice.create({
        data: {
          visitId: visit.id,
          invoiceNumber: 'INV-1',
          subtotal: 20,
          total: 20,
          balanceDue: 20,
        },
      }),
    );
    const register = await scoped(() =>
      prisma.clinicCashSession.create({ data: { openedByUserId: userId } }),
    );
    const payload = {
      paymentMethod: 'mobile_money',
      amount: 20,
      referenceNumber: 'MOMO-1',
    };
    const pay = () =>
      scoped(() =>
        service.run(
          key,
          'clinic_payment',
          userId,
          { visitId: visit.id, body: payload },
          () => billing.recordPayment(visit.id, payload, userId),
        ),
      );
    const original = await pay();
    await scoped(() =>
      prisma.clinicCashSession.update({
        where: { id: register.id },
        data: { status: 'closed', closedAt: new Date() },
      }),
    );
    const recovered = await pay();
    expect(recovered.payment.id).toBe(original.payment.id);
    expect(Number(recovered.invoice.balanceDue)).toBe(0);
    expect(recovered.payment.referenceNumber).toBe('MOMO-1');
    expect(await scoped(() => prisma.clinicPayment.count())).toBe(1);
  });

  it('recovers a supplier settlement without duplicating its accounting expense', async () => {
    const payables = new PharmacyPayablesService(prisma);
    const recorderId = randomUUID();
    await scoped(() =>
      prisma.user.create({
        data: {
          id: recorderId,
          fullName: 'Invoice recorder',
          email: `${recorderId}@example.test`,
          passwordHash: 'test-only',
          role: 4,
        },
      }),
    );
    const location = await scoped(() =>
      prisma.pharmacyLocation.create({
        data: { code: 'MAIN', name: 'Main pharmacy', tenantId },
      }),
    );
    const supplier = await scoped(() =>
      prisma.pharmacySupplier.create({
        data: {
          supplierCode: 'SUP-1',
          name: 'Test supplier',
          normalizedName: 'test supplier',
          tenantId,
        },
      }),
    );
    const receipt = await scoped(() =>
      prisma.pharmacyGoodsReceipt.create({
        data: {
          receiptNumber: 'GRN-1',
          receivedAt: new Date(),
          tenantId,
          locationId: location.id,
          supplierId: supplier.id,
          supplierName: supplier.name,
          createdByUserId: recorderId,
          totalCost: 20,
        },
      }),
    );
    const invoice = await scoped(() =>
      prisma.pharmacySupplierInvoice.create({
        data: {
          invoiceNumber: 'SINV-1',
          supplierInvoiceNumber: 'SUP-INV-1',
          invoiceDate: new Date(),
          dueDate: new Date(),
          totalAmount: 20,
          balanceDue: 20,
          tenantId,
          locationId: location.id,
          supplierId: supplier.id,
          receiptId: receipt.id,
          createdByUserId: recorderId,
        },
      }),
    );
    const payload = {
      invoiceId: invoice.id,
      paymentMethod: 'cash',
      amount: 20,
    };
    const pay = () =>
      scoped(() =>
        service.run(
          key,
          'pharmacy_supplier_payment',
          userId,
          { locationId: location.id, body: payload },
          () => payables.recordPayment(payload, userId, location.id),
        ),
      );
    const original = await pay();
    expect((await pay()).id).toBe(original.id);
    expect(await scoped(() => prisma.pharmacySupplierPayment.count())).toBe(1);
    expect(await scoped(() => prisma.expense.count())).toBe(1);
    expect(
      Number(
        (
          await scoped(() =>
            prisma.pharmacySupplierInvoice.findUniqueOrThrow({
              where: { id: invoice.id },
            }),
          )
        ).balanceDue,
      ),
    ).toBe(0);
  });
});
