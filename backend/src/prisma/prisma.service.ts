import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as path from 'path';
import { TenantContextService } from '../common/multitenancy/tenant-context.service';

const TENANT_MODELS = new Set([
  'User',
  'Patient',
  'Department',
  'Service',
  'Visit',
  'ClinicInvoice',
  'ClinicPayment',
  'PharmacyProduct',
  'PharmacySale',
  'PharmacyDailyClosure',
  'AuditLog',
  'Prescription'
]);

const isTenantModel = (model: string): boolean => TENANT_MODELS.has(model);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly extendedClient: any;

  constructor() {
    const isProduction = process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:');
    let adapter: any;

    if (isProduction) {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      adapter = new PrismaPg(pool);
    } else {
      const baseDir = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
      const dbPath = path.join(baseDir, 'dev.db');
      adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
    }

    super({ adapter });

    const self = this;
    this.extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const tenantId = TenantContextService.getTenantId();
            const anyArgs = args as any;

            if (tenantId && isTenantModel(model)) {
              anyArgs.where = anyArgs.where || {};

              if (operation === 'create') {
                anyArgs.data = anyArgs.data || {};
                anyArgs.data.tenantId = tenantId;
              } else if (operation === 'createMany') {
                if (Array.isArray(anyArgs.data)) {
                  anyArgs.data = anyArgs.data.map((item: any) => ({ ...item, tenantId }));
                } else if (anyArgs.data) {
                  anyArgs.data.tenantId = tenantId;
                }
              } else if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
                // Convert findUnique to findFirst to allow filtering by tenantId (non-unique composite constraint)
                const findFirstOperation = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
                const newArgs = {
                  ...args,
                  where: {
                    ...anyArgs.where,
                    tenantId,
                  },
                };
                return (self.extendedClient as any)[model][findFirstOperation](newArgs);
              } else if (
                operation === 'findFirst' ||
                operation === 'findFirstOrThrow' ||
                operation === 'findMany' ||
                operation === 'update' ||
                operation === 'updateMany' ||
                operation === 'delete' ||
                operation === 'deleteMany' ||
                operation === 'count' ||
                operation === 'aggregate' ||
                operation === 'groupBy'
              ) {
                anyArgs.where.tenantId = tenantId;
              }
            }

            return query(args);
          },
        },
      },
    });

    // Proxy property access to the extended client so that NestJS injection
    // resolves model delegates (e.g. this.prisma.user) to the extended version transparently.
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target.extendedClient) {
          return Reflect.get(target.extendedClient, prop, receiver);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
