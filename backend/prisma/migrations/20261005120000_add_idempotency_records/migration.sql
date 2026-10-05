-- PharmaFlow idempotency records patch.
-- Apply manually with:
-- npx prisma db execute --file prisma/migrations/20261005120000_add_idempotency_records/migration.sql

CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'in_progress',
  "responseJson" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IdempotencyRecord_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_tenant_user_key_uidx"
  ON "IdempotencyRecord"("tenantId", "userId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "IdempotencyRecord_tenant_operation_created_idx"
  ON "IdempotencyRecord"("tenantId", "operation", "createdAt");

CREATE INDEX IF NOT EXISTS "IdempotencyRecord_expiresAt_idx"
  ON "IdempotencyRecord"("expiresAt");
