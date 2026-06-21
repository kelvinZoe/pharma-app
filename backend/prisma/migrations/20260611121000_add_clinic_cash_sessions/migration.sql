CREATE TABLE IF NOT EXISTS "ClinicCashSession" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "openedByUserId" TEXT NOT NULL,
  "closedByUserId" TEXT,
  "openingFloat" DECIMAL NOT NULL DEFAULT 0.00,
  "cashCounted" DECIMAL,
  "momoCounted" DECIMAL,
  "expectedCash" DECIMAL,
  "expectedMomo" DECIMAL,
  "totalCounted" DECIMAL,
  "discrepancy" DECIMAL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT,
  CONSTRAINT "ClinicCashSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClinicPayment"
ADD COLUMN IF NOT EXISTS "clinicCashSessionId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClinicCashSession_tenantId_fkey'
  ) THEN
    ALTER TABLE "ClinicCashSession"
    ADD CONSTRAINT "ClinicCashSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClinicCashSession_openedByUserId_fkey'
  ) THEN
    ALTER TABLE "ClinicCashSession"
    ADD CONSTRAINT "ClinicCashSession_openedByUserId_fkey"
    FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClinicCashSession_closedByUserId_fkey'
  ) THEN
    ALTER TABLE "ClinicCashSession"
    ADD CONSTRAINT "ClinicCashSession_closedByUserId_fkey"
    FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClinicPayment_clinicCashSessionId_fkey'
  ) THEN
    ALTER TABLE "ClinicPayment"
    ADD CONSTRAINT "ClinicPayment_clinicCashSessionId_fkey"
    FOREIGN KEY ("clinicCashSessionId") REFERENCES "ClinicCashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ClinicCashSession_tenantId_status_idx"
ON "ClinicCashSession"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "ClinicCashSession_tenantId_openedAt_idx"
ON "ClinicCashSession"("tenantId", "openedAt");

CREATE INDEX IF NOT EXISTS "ClinicPayment_clinicCashSessionId_idx"
ON "ClinicPayment"("clinicCashSessionId");
