import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReportsService } from '../src/reports/reports.service';
import { VisitsService } from '../src/visits/visits.service';
import { UsersService } from '../src/users/users.service';
import { SettingsService } from '../src/settings/settings.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PharmacyService } from '../src/pharmacy/pharmacy.service';
import { AccountingService } from '../src/accounting/accounting.service';
import { Role } from '../src/auth/authorization/permissions';
import { TenantContextService } from '../src/common/multitenancy/tenant-context.service';

describe('Permission enforcement over HTTP', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const users = new Map<string, any>();
  const readUser = jest.fn(({ where }: any) =>
    Promise.resolve(users.get(where.id) ?? null),
  );
  const reports = { getCombinedSummary: jest.fn(() => ({ combinedTotal: 0 })) };
  const visits = {
    searchPatients: jest.fn(() => []),
    getActiveVisits: jest.fn(() => []),
  };
  const staff = {
    findAll: jest.fn(() => []),
    findProfile: jest.fn((id) => ({ id })),
  };
  const settings = {
    getSettings: jest.fn(() => ({ clinicName: 'Test clinic' })),
  };
  const notifications = {
    findMine: jest.fn(() => []),
    unreadCount: jest.fn(() => ({ count: 0 })),
  };
  const pharmacy = { findAllProducts: jest.fn(() => []) };
  const accounting = {
    listPeriods: jest.fn(() => []),
    reviewReversal: jest.fn(),
  };
  const location = {
    id: 'assigned-branch',
    code: 'MAIN',
    name: 'Assigned branch',
    isActive: true,
    tenantId: 'test-tenant',
  };

  const user = (role: Role, roles: any = [role]) => {
    const record = {
      id: `user-${role}`,
      role,
      roles,
      fullName: 'Test staff',
      email: `user-${role}@example.test`,
      username: `staff-${role}`,
      isActive: true,
      tenantId: 'test-tenant',
      tenant: { slug: 'test-clinic', name: 'Test clinic' },
    };
    users.set(record.id, record);
    return record;
  };
  const token = (record: any) =>
    jwt.sign({ sub: record.id, role: record.role, tenantId: record.tenantId });
  const auth = (role: Role) => `Bearer ${token(user(role))}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        user: { findUnique: readUser },
        pharmacyLocation: {
          findMany: jest.fn(() => [
            { ...location, tenantId: TenantContextService.getTenantId() },
          ]),
        },
        userPharmacyLocation: { findMany: jest.fn(() => [{ location }]) },
      })
      .overrideProvider(ReportsService)
      .useValue(reports)
      .overrideProvider(VisitsService)
      .useValue(visits)
      .overrideProvider(UsersService)
      .useValue(staff)
      .overrideProvider(SettingsService)
      .useValue(settings)
      .overrideProvider(NotificationsService)
      .useValue(notifications)
      .overrideProvider(PharmacyService)
      .useValue(pharmacy)
      .overrideProvider(AccountingService)
      .useValue(accounting)
      .compile();
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(() => {
    users.clear();
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each([
    ['get', '/reports/summary', Role.Frontdesk],
    ['get', '/patients/search?query=Arthur', Role.Pharmacy],
    ['post', '/visits/visit/invoice/pay', Role.Pharmacy],
    ['post', '/pharmacy/sales', Role.Accounting],
    ['post', '/pharmacy/products', Role.Pharmacy],
    ['post', '/pharmacy/supplier-payments', Role.Pharmacy],
    ['post', '/pharmacy/purchase-returns', Role.Pharmacy],
    ['post', '/pharmacy/transfers/transfer/approve', Role.Pharmacy],
    ['post', '/pharmacy/stock-counts/count/approve', Role.Pharmacy],
    ['post', '/pharmacy/quarantine/batch/resolve', Role.Pharmacy],
    ['post', '/pharmacy/goods-receipts', Role.Accounting],
    ['post', '/settings', Role.Pharmacy],
    ['post', '/users', Role.Scanning],
    ['post', '/accounting/periods/lock', Role.Pharmacy],
    ['post', '/accounting/reversals/reversal/approve', Role.Frontdesk],
    ['post', '/expenses', Role.Laboratory],
    ['post', '/reports/pharmacy/sale/void', Role.Pharmacy],
  ] as const)(
    'denies %s %s to role %s before domain writes',
    async (method, path, role) => {
      await request(app.getHttpServer())
        [method](`/api${path}`)
        .set('Authorization', auth(role))
        .send({ amount: 20 })
        .expect(403);
      expect(accounting.reviewReversal).not.toHaveBeenCalled();
      expect(visits.searchPatients).not.toHaveBeenCalled();
      expect(pharmacy.findAllProducts).not.toHaveBeenCalled();
      expect(staff.findAll).not.toHaveBeenCalled();
    },
  );

  it('allows accounting reports and preserves full administrator access in a diagnostic workspace', async () => {
    await request(app.getHttpServer())
      .get('/api/reports/summary')
      .set('Authorization', auth(Role.Accounting))
      .expect(200);
    const admin = user(Role.Admin, '0');
    const selectedWorkspaceToken = jwt.sign({
      sub: admin.id,
      role: Role.Scanning,
      tenantId: admin.tenantId,
    });
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${selectedWorkspaceToken}`)
      .expect(200);
    expect(staff.findAll).toHaveBeenCalledTimes(1);
  });

  it.each([
    Role.Admin,
    Role.Frontdesk,
    Role.Laboratory,
    Role.Scanning,
    Role.Pharmacy,
    Role.Accounting,
  ])(
    'preserves profile, notification and settings reads for role %s',
    async (role) => {
      const authorization = auth(role);
      for (const path of [
        '/auth/profile',
        '/users/me',
        '/notifications',
        '/settings',
      ]) {
        await request(app.getHttpServer())
          .get(`/api${path}`)
          .set('Authorization', authorization)
          .expect(200);
      }
    },
  );

  it('supports multiple assigned roles without granting pharmacy checkout', async () => {
    const record = user(Role.Frontdesk, '1,5');
    const authorization = `Bearer ${token(record)}`;
    await request(app.getHttpServer())
      .get('/api/reports/summary')
      .set('Authorization', authorization)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/pharmacy/sales')
      .set('Authorization', authorization)
      .send({})
      .expect(403);
  });

  it('uses current database assignments, not stale token roles', async () => {
    const record = user(Role.Accounting);
    const authorization = `Bearer ${token(record)}`;
    await request(app.getHttpServer())
      .get('/api/reports/summary')
      .set('Authorization', authorization)
      .expect(200);
    users.set(record.id, { ...record, role: Role.Frontdesk, roles: '1' });
    await request(app.getHttpServer())
      .get('/api/reports/summary')
      .set('Authorization', authorization)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/auth/profile')
      .set('Authorization', authorization)
      .expect(200)
      .expect(({ body }) => {
        expect(body.role).toBe(Role.Frontdesk);
        expect(body.roles).toEqual([Role.Frontdesk]);
      });
  });

  it('does not fall back to an unassigned primary role after role revocation', async () => {
    const record = user(Role.Accounting, '1');
    await request(app.getHttpServer())
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token(record)}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.role).toBe(Role.Frontdesk);
        expect(body.module).toBe('frontdesk');
      });
  });

  it.each(['', ',', '0,', '0,99', []])(
    'rejects malformed database role assignments: %j',
    async (roles) => {
      const record = user(Role.Admin, roles);
      await request(app.getHttpServer())
        .get('/api/users')
        .set('Authorization', `Bearer ${token(record)}`)
        .expect(401);
      expect(staff.findAll).not.toHaveBeenCalled();
    },
  );

  it('rejects missing, forged and deactivated identities', async () => {
    await request(app.getHttpServer()).get('/api/reports/summary').expect(401);
    const forged = new JwtService({ secret: 'invalid-test-secret' }).sign({
      sub: 'forged',
      tenantId: 'test-tenant',
      role: Role.Admin,
    });
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
    expect(readUser).not.toHaveBeenCalled();
    const record = user(Role.Admin);
    users.set(record.id, { ...record, isActive: false });
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token(record)}`)
      .expect(401);
    expect(staff.findAll).not.toHaveBeenCalled();
  });

  it('retains branch restrictions after the route permission succeeds', async () => {
    const authorization = auth(Role.Pharmacy);
    await request(app.getHttpServer())
      .get('/api/pharmacy/products')
      .set('Authorization', authorization)
      .set('X-Pharmacy-Location-Id', 'unassigned-branch')
      .expect(403);
    expect(pharmacy.findAllProducts).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get('/api/pharmacy/products')
      .set('Authorization', authorization)
      .set('X-Pharmacy-Location-Id', location.id)
      .expect(200);
    expect(pharmacy.findAllProducts).toHaveBeenCalledWith(location.id);
  });

  it('rejects a token whose tenant does not match its current database identity', async () => {
    const record = user(Role.Admin);
    const mismatched = jwt.sign({
      sub: record.id,
      role: Role.Admin,
      tenantId: 'other-tenant',
    });
    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${mismatched}`)
      .expect(401);
    expect(staff.findAll).not.toHaveBeenCalled();
  });

  it('ignores role and permission claims in tokens and request bodies', async () => {
    const record = user(Role.Pharmacy);
    const elevatedClaims = jwt.sign({
      sub: record.id,
      role: Role.Admin,
      roles: [Role.Admin],
      permissions: ['settings.manage'],
      tenantId: record.tenantId,
    });
    await request(app.getHttpServer())
      .post('/api/settings')
      .set('Authorization', `Bearer ${elevatedClaims}`)
      .send({
        role: Role.Admin,
        roles: [Role.Admin],
        permissions: ['settings.manage'],
      })
      .expect(403);
  });
});
