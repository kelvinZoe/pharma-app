import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as path from 'path';
import { TenantContextService } from '../common/multitenancy/tenant-context.service';
import { getInternetDate } from '../common/clock';

const TENANT_MODELS = new Set([
  'User',
  'Patient',
  'Department',
  'Service',
  'Visit',
  'ClinicInvoice',
  'ClinicPayment',
  'ClinicCashSession',
  'PharmacyMedicine',
  'PharmacyProduct',
  'PharmacyLocation',
  'UserPharmacyLocation',
  'PharmacyBatch',
  'PharmacyStockMovement',
  'PharmacyLocationProduct',
  'PharmacySupplier',
  'PharmacyPurchaseOrder',
  'PharmacyPurchaseOrderLine',
  'PharmacyGoodsReceipt',
  'PharmacyGoodsReceiptLine',
  'PharmacySupplierInvoice',
  'PharmacySupplierPayment',
  'PharmacyPurchaseReturn',
  'PharmacyPurchaseReturnLine',
  'PharmacyStockCount',
  'PharmacyStockCountLine',
  'PharmacyStockAdjustment',
  'PharmacyTransfer',
  'PharmacyTransferLine',
  'PharmacySale',
  'PharmacySaleItem',
  'PharmacyDailyClosure',
  'AuditLog',
  'Prescription',
  'GeneralTemplate',
  'Expense',
  'Notification'
]);

const MODELS_WITH_CREATED_AT = new Set([
  'Tenant', 'Department', 'User', 'Patient', 'Visit', 'Service', 'VisitService',
  'ServiceResultTemplate', 'VisitResult', 'Prescription', 'ClinicInvoice',
  'ClinicPayment', 'ClinicCashSession', 'PharmacyProduct', 'PharmacyBatch', 'PharmacyStockMovement',
  'PharmacyLocationProduct', 'PharmacySupplier', 'PharmacyPurchaseOrder', 'PharmacyPurchaseOrderLine', 'PharmacyGoodsReceipt', 'PharmacyGoodsReceiptLine',
  'PharmacySupplierInvoice', 'PharmacySupplierPayment', 'PharmacyPurchaseReturn', 'PharmacyPurchaseReturnLine',
  'PharmacyStockCount', 'PharmacyStockCountLine', 'PharmacyStockAdjustment',
  'PharmacyTransfer', 'PharmacyTransferLine',
  'PharmacyLocation', 'UserPharmacyLocation', 'PharmacySale', 'PharmacySaleItem', 'AuditLog', 'PharmacyDailyClosure',
  'GeneralTemplate', 'Expense', 'Notification'
]);

const MODELS_WITH_UPDATED_AT = new Set([
  'Tenant', 'Department', 'User', 'Patient', 'Visit', 'Service', 'VisitService',
  'ServiceResultTemplate', 'VisitResult', 'Prescription', 'ClinicInvoice',
  'ClinicPayment', 'ClinicCashSession', 'PharmacyProduct', 'PharmacyBatch',
  'PharmacyLocationProduct', 'PharmacySupplier', 'PharmacyPurchaseOrder', 'PharmacyPurchaseOrderLine', 'PharmacyGoodsReceipt',
  'PharmacySupplierInvoice', 'PharmacySupplierPayment', 'PharmacyPurchaseReturn',
  'PharmacyStockCount', 'PharmacyStockCountLine', 'PharmacyStockAdjustment',
  'PharmacyTransfer', 'PharmacyTransferLine',
  'PharmacyLocation', 'UserPharmacyLocation', 'PharmacySale', 'PharmacyDailyClosure', 'GeneralTemplate', 'Expense', 'Notification'
]);

const isTenantModel = (model: string): boolean => TENANT_MODELS.has(model);

const RELATION_SCOPED_MODELS = new Set([
  'Tenant',
  'VisitService',
  'ServiceResultTemplate',
  'VisitResult',
  'GeneralTemplateService',
]);

const isTenantScopedModel = (model: string): boolean => isTenantModel(model) || RELATION_SCOPED_MODELS.has(model);

function relationTenantFilter(model: string, tenantId: string): Record<string, unknown> {
  switch (model) {
    case 'Tenant': return { id: tenantId };
    case 'VisitService': return { visit: { tenantId } };
    case 'ServiceResultTemplate': return { service: { tenantId } };
    case 'VisitResult': return { visitService: { visit: { tenantId } } };
    case 'GeneralTemplateService': return { generalTemplate: { tenantId } };
    default: return {};
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly extendedClient: any;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isProduction = process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:');
    let adapter: any;

    if (isProduction) {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        idleTimeoutMillis: 120000,       // Release idle connections after 2 minutes
        connectionTimeoutMillis: 10000,  // Wait up to 10s to acquire a connection
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });
      pool.on('error', (err) => {
        this.logger.warn(`[PgPool] Pool client error: ${err.message}`);
      });
      adapter = new PrismaPg(pool);
    } else {
      const baseDir = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
      const dbPath = path.join(baseDir, 'dev.db');
      adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
    }

    super({
      adapter,
      transactionOptions: {
        maxWait: 15_000,
        timeout: 30_000,
      },
    });

    const self = this;
    this.extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const tenantId = TenantContextService.getTenantId();
            const anyArgs = args as any;

            if (!tenantId && isTenantScopedModel(model) && !TenantContextService.isUnscopedAllowed()) {
              throw new Error(`Tenant context is required for ${model}.${operation}`);
            }

            // 1. Inject Tenant ID
            if (tenantId && isTenantModel(model)) {
              if (operation === 'create') {
                anyArgs.data = anyArgs.data || {};
                anyArgs.data.tenantId = tenantId;
              } else if (operation === 'createMany') {
                if (Array.isArray(anyArgs.data)) {
                  anyArgs.data = anyArgs.data.map((item: any) => ({ ...item, tenantId }));
                } else if (anyArgs.data) {
                  anyArgs.data.tenantId = tenantId;
                }
              } else if (operation === 'upsert') {
                anyArgs.where = { ...(anyArgs.where || {}), tenantId };
                anyArgs.create = { ...(anyArgs.create || {}), tenantId };
              } else if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
                const findFirstOperation = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
                const currentWhere = anyArgs.where || {};
                const newArgs = {
                  ...args,
                  where: {
                    ...currentWhere,
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
                anyArgs.where = anyArgs.where || {};
                anyArgs.where.tenantId = tenantId;
              }
            } else if (tenantId && RELATION_SCOPED_MODELS.has(model)) {
              const tenantFilter = relationTenantFilter(model, tenantId);
              if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
                const findFirstOperation = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
                const newArgs = {
                  ...args,
                  where: { ...(anyArgs.where || {}), ...tenantFilter },
                };
                return (self.extendedClient as any)[model][findFirstOperation](newArgs);
              }
              if (
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
                anyArgs.where = { ...(anyArgs.where || {}), ...tenantFilter };
              }
            }

            // 2. Inject Internet Time for Timestamps
            const internetTime = getInternetDate();

            if (operation === 'create' || operation === 'createMany') {
              if (operation === 'create') {
                anyArgs.data = anyArgs.data || {};
                
                // standard timestamps
                if (MODELS_WITH_CREATED_AT.has(model) && anyArgs.data.createdAt === undefined) {
                  anyArgs.data.createdAt = internetTime;
                }
                if (MODELS_WITH_UPDATED_AT.has(model) && anyArgs.data.updatedAt === undefined) {
                  anyArgs.data.updatedAt = internetTime;
                }

                // other model-specific default timestamps
                if (model === 'Visit' && anyArgs.data.visitDate === undefined) {
                  anyArgs.data.visitDate = internetTime;
                }
                if ((model === 'ClinicPayment' || model === 'PharmacySale') && anyArgs.data.paidAt === undefined) {
                  anyArgs.data.paidAt = internetTime;
                }
                if (model === 'PharmacyDailyClosure' && anyArgs.data.closureDate === undefined) {
                  anyArgs.data.closureDate = internetTime;
                }
                if (model === 'Expense' && anyArgs.data.expenseDate === undefined) {
                  anyArgs.data.expenseDate = internetTime;
                }

              } else if (operation === 'createMany') {
                if (Array.isArray(anyArgs.data)) {
                  anyArgs.data = anyArgs.data.map((item: any) => {
                    const newItem = { ...item };
                    if (MODELS_WITH_CREATED_AT.has(model) && newItem.createdAt === undefined) {
                      newItem.createdAt = internetTime;
                    }
                    if (MODELS_WITH_UPDATED_AT.has(model) && newItem.updatedAt === undefined) {
                      newItem.updatedAt = internetTime;
                    }
                    if (model === 'Visit' && newItem.visitDate === undefined) {
                      newItem.visitDate = internetTime;
                    }
                    if ((model === 'ClinicPayment' || model === 'PharmacySale') && newItem.paidAt === undefined) {
                      newItem.paidAt = internetTime;
                    }
                    if (model === 'PharmacyDailyClosure' && newItem.closureDate === undefined) {
                      newItem.closureDate = internetTime;
                    }
                    if (model === 'Expense' && newItem.expenseDate === undefined) {
                      newItem.expenseDate = internetTime;
                    }
                    return newItem;
                  });
                }
              }
            } else if (operation === 'update' || operation === 'updateMany') {
              if (operation === 'update') {
                anyArgs.data = anyArgs.data || {};
                if (MODELS_WITH_UPDATED_AT.has(model) && anyArgs.data.updatedAt === undefined) {
                  anyArgs.data.updatedAt = internetTime;
                }
              } else if (operation === 'updateMany') {
                anyArgs.data = anyArgs.data || {};
                if (MODELS_WITH_UPDATED_AT.has(model) && anyArgs.data.updatedAt === undefined) {
                  anyArgs.data.updatedAt = internetTime;
                }
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

    // Send a keepalive ping every 90 seconds so the pool connection
    // to Supabase never sits idle long enough to be terminated.
    const isProduction = process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:');
    if (isProduction) {
      this.heartbeatTimer = setInterval(async () => {
        try {
          await this.$queryRaw`SELECT 1`;
        } catch (err: any) {
          this.logger.warn(`[Heartbeat] Keepalive ping failed (will reconnect on next query): ${err?.message}`);
        }
      }, 90_000);
    }
  }

  async onModuleDestroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    await this.$disconnect();
  }
}
