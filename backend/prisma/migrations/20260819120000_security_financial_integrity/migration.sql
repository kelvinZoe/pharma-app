-- PharmaFlow production Postgres integrity patch.
-- Apply manually with:
-- npx prisma db execute --file prisma/migrations/20260819120000_security_financial_integrity/migration.sql

UPDATE "ClinicPayment"
SET "referenceNumber" = NULLIF(UPPER(BTRIM("referenceNumber")), '')
WHERE "referenceNumber" IS NOT NULL;

UPDATE "PharmacySale"
SET "referenceNumber" = NULLIF(UPPER(BTRIM("referenceNumber")), '')
WHERE "referenceNumber" IS NOT NULL;

UPDATE "PharmacySupplierPayment"
SET "referenceNumber" = NULLIF(UPPER(BTRIM("referenceNumber")), '')
WHERE "referenceNumber" IS NOT NULL;

UPDATE "PharmacySupplierInvoice"
SET "supplierInvoiceNumber" = UPPER(BTRIM("supplierInvoiceNumber"));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ClinicCashSession"
    WHERE "status" IN ('open', 'closing') AND "tenantId" IS NOT NULL
    GROUP BY "tenantId", "openedByUserId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate open clinic cashier sessions exist. Close duplicates before applying this patch.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "PharmacyDailyClosure"
    WHERE "status" IN ('open', 'closing') AND "tenantId" IS NOT NULL AND "locationId" IS NOT NULL
    GROUP BY "tenantId", "locationId", "openedByUserId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate open pharmacy registers exist. Close duplicates before applying this patch.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "PharmacyStockCount"
    WHERE "status" IN ('counting', 'updating', 'submitting', 'submitted', 'posting')
    GROUP BY "tenantId", "locationId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate active stock counts exist. Complete duplicates before applying this patch.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "ClinicPayment"
    WHERE "paymentMethod" = 'mobile_money' AND "status" <> 'voided' AND "referenceNumber" IS NOT NULL AND "tenantId" IS NOT NULL
    GROUP BY "tenantId", "referenceNumber" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate live clinic mobile-money references exist. Resolve duplicates before applying this patch.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "PharmacySale"
    WHERE "paymentMethod" = 'mobile_money' AND "status" <> 'voided' AND "referenceNumber" IS NOT NULL AND "tenantId" IS NOT NULL
    GROUP BY "tenantId", "referenceNumber" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate live pharmacy mobile-money references exist. Resolve duplicates before applying this patch.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "PharmacySupplierPayment"
    WHERE "referenceNumber" IS NOT NULL
    GROUP BY "tenantId", "referenceNumber" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate supplier-payment references exist. Resolve duplicates before applying this patch.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "PharmacySupplierInvoice"
    GROUP BY "tenantId", "supplierId", "supplierInvoiceNumber" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate supplier invoice numbers exist. Resolve duplicates before applying this patch.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicCashSession_one_open_per_user_uidx"
  ON "ClinicCashSession"("tenantId", "openedByUserId")
  WHERE "status" IN ('open', 'closing') AND "tenantId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyDailyClosure_one_open_register_uidx"
  ON "PharmacyDailyClosure"("tenantId", "locationId", "openedByUserId")
  WHERE "status" IN ('open', 'closing') AND "tenantId" IS NOT NULL AND "locationId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyStockCount_one_active_per_location_uidx"
  ON "PharmacyStockCount"("tenantId", "locationId")
  WHERE "status" IN ('counting', 'updating', 'submitting', 'submitted', 'posting');

CREATE UNIQUE INDEX IF NOT EXISTS "ClinicPayment_live_momo_reference_uidx"
  ON "ClinicPayment"("tenantId", "referenceNumber")
  WHERE "paymentMethod" = 'mobile_money' AND "status" <> 'voided' AND "referenceNumber" IS NOT NULL AND "tenantId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacySale_live_momo_reference_uidx"
  ON "PharmacySale"("tenantId", "referenceNumber")
  WHERE "paymentMethod" = 'mobile_money' AND "status" <> 'voided' AND "referenceNumber" IS NOT NULL AND "tenantId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacySupplierPayment_reference_uidx"
  ON "PharmacySupplierPayment"("tenantId", "referenceNumber")
  WHERE "referenceNumber" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacySupplierInvoice_supplier_reference_uidx"
  ON "PharmacySupplierInvoice"("tenantId", "supplierId", "supplierInvoiceNumber");

CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_createdAt_idx"
  ON "AuditLog"("tenantId", "createdAt" DESC);
