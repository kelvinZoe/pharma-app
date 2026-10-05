BEGIN;

CREATE TABLE IF NOT EXISTS "AccountingPeriod" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "lockedByUserId" TEXT NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("endDate" >= "startDate"),
  CHECK (length(trim("reason")) BETWEEN 5 AND 1000)
);
CREATE INDEX IF NOT EXISTS "AccountingPeriod_tenantId_startDate_endDate_idx" ON "AccountingPeriod"("tenantId", "startDate", "endDate");

CREATE TABLE IF NOT EXISTS "FinancialReversal" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "clinicPaymentId" TEXT REFERENCES "ClinicPayment"("id"),
  "pharmacySaleId" TEXT REFERENCES "PharmacySale"("id"),
  "expenseId" TEXT REFERENCES "Expense"("id"),
  "amount" DECIMAL(65,30) NOT NULL CHECK ("amount" > 0),
  "costOfGoods" DECIMAL(65,30) NOT NULL DEFAULT 0 CHECK ("costOfGoods" >= 0),
  "paymentMethod" TEXT,
  "locationId" TEXT REFERENCES "PharmacyLocation"("id"),
  "sourceDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL CHECK (length(trim("reason")) BETWEEN 5 AND 1000),
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected')),
  "requestedByUserId" TEXT NOT NULL REFERENCES "User"("id"),
  "reviewedByUserId" TEXT REFERENCES "User"("id"),
  "reviewReason" TEXT,
  "postedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    ("entityType" = 'clinic' AND "clinicPaymentId" = "entityId" AND "clinicPaymentId" IS NOT NULL AND "pharmacySaleId" IS NULL AND "expenseId" IS NULL) OR
    ("entityType" = 'pharmacy' AND "pharmacySaleId" = "entityId" AND "pharmacySaleId" IS NOT NULL AND "clinicPaymentId" IS NULL AND "expenseId" IS NULL) OR
    ("entityType" = 'expense' AND "expenseId" = "entityId" AND "expenseId" IS NOT NULL AND "clinicPaymentId" IS NULL AND "pharmacySaleId" IS NULL)
  ),
  CHECK (
    ("status" = 'pending' AND "reviewedByUserId" IS NULL AND "reviewedAt" IS NULL AND "postedAt" IS NULL) OR
    ("status" = 'approved' AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "postedAt" IS NOT NULL) OR
    ("status" = 'rejected' AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "postedAt" IS NULL AND "reviewReason" IS NOT NULL AND length(trim("reviewReason")) BETWEEN 5 AND 1000)
  ),
  CHECK ("reviewedByUserId" IS NULL OR "reviewedByUserId" <> "requestedByUserId")
);
CREATE INDEX IF NOT EXISTS "FinancialReversal_tenantId_status_createdAt_idx" ON "FinancialReversal"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "FinancialReversal_tenantId_postedAt_locationId_idx" ON "FinancialReversal"("tenantId", "postedAt", "locationId");
CREATE INDEX IF NOT EXISTS "FinancialReversal_tenantId_entityType_entityId_idx" ON "FinancialReversal"("tenantId", "entityType", "entityId");
CREATE UNIQUE INDEX IF NOT EXISTS "FinancialReversal_one_live_source" ON "FinancialReversal"("tenantId", "entityType", "entityId") WHERE "status" IN ('pending', 'approved');

CREATE OR REPLACE FUNCTION pharma_guard_accounting_period() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Locked accounting periods cannot be changed or deleted' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."tenantId", 0));
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = NEW."lockedByUserId" AND "tenantId" = NEW."tenantId") THEN
    RAISE EXCEPTION 'Period closer must belong to the same tenant' USING ERRCODE = '23514';
  END IF;
  IF NEW."endDate" >= date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Only completed accounting periods can be locked' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "AccountingPeriod" WHERE "tenantId" = NEW."tenantId" AND "startDate" <= NEW."endDate" AND "endDate" >= NEW."startDate") THEN
    RAISE EXCEPTION 'Accounting period overlaps an existing lock' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "ClinicCashSession" WHERE "tenantId" = NEW."tenantId" AND "status" = 'open' AND "openedAt" <= NEW."endDate") OR
     EXISTS (SELECT 1 FROM "PharmacyDailyClosure" WHERE "tenantId" = NEW."tenantId" AND "status" = 'open' AND "createdAt" <= NEW."endDate") THEN
    RAISE EXCEPTION 'Close cashier shifts before locking this period' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "guard_accounting_period" ON "AccountingPeriod";
CREATE TRIGGER "guard_accounting_period" BEFORE INSERT OR UPDATE OR DELETE ON "AccountingPeriod" FOR EACH ROW EXECUTE FUNCTION pharma_guard_accounting_period();

CREATE OR REPLACE FUNCTION pharma_guard_financial_posting() RETURNS TRIGGER AS $$
DECLARE
  previous_row JSONB;
  next_row JSONB;
  target_tenant TEXT;
BEGIN
  previous_row := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END;
  next_row := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END;
  target_tenant := COALESCE(next_row->>'tenantId', previous_row->>'tenantId');
  IF target_tenant IS NULL THEN
    RAISE EXCEPTION 'Financial posting requires a tenant' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(target_tenant, 0));
  IF TG_OP = 'UPDATE' AND previous_row->>'tenantId' IS DISTINCT FROM next_row->>'tenantId' THEN
    RAISE EXCEPTION 'Financial entries cannot change tenant' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "AccountingPeriod" WHERE "tenantId" = target_tenant AND (
      (previous_row IS NOT NULL AND (previous_row->>TG_ARGV[0])::timestamp BETWEEN "startDate" AND "endDate") OR
      (next_row IS NOT NULL AND (next_row->>TG_ARGV[0])::timestamp BETWEEN "startDate" AND "endDate")
    )
  ) THEN
    RAISE EXCEPTION 'Accounting period is locked; use an approved reversal' USING ERRCODE = '23514';
  END IF;
  IF TG_OP <> 'INSERT' AND TG_ARGV[1] <> '' AND EXISTS (
    SELECT 1 FROM "FinancialReversal" WHERE "tenantId" = target_tenant AND "entityType" = TG_ARGV[1] AND "entityId" = previous_row->>'id' AND "status" IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'Entry has a pending or approved reversal' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  table_name TEXT;
  date_column TEXT;
  entity_type TEXT;
BEGIN
  FOR table_name, date_column, entity_type IN SELECT * FROM (VALUES
    ('ClinicPayment', 'paidAt', 'clinic'), ('PharmacySale', 'paidAt', 'pharmacy'),
    ('Expense', 'expenseDate', 'expense'), ('PharmacyGoodsReceipt', 'receivedAt', ''),
    ('PharmacySupplierPayment', 'paymentDate', ''), ('PharmacyPurchaseReturn', 'returnDate', '')
  ) AS targets(table_name, date_column, entity_type) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS guard_financial_posting ON %I', table_name);
    EXECUTE format('CREATE TRIGGER guard_financial_posting BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION pharma_guard_financial_posting(%L, %L)', table_name, date_column, entity_type);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION pharma_guard_financial_reversal() RETURNS TRIGGER AS $$
DECLARE
  source_row JSONB;
  maker_id TEXT;
  expected_cost NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD."status" <> 'pending') THEN
    RAISE EXCEPTION 'Reviewed reversals cannot be changed or deleted' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."tenantId", 0));
  IF TG_OP = 'INSERT' AND NEW."status" <> 'pending' THEN
    RAISE EXCEPTION 'Reversals must be requested before approval' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - ARRAY['status','reviewedByUserId','reviewReason','reviewedAt','postedAt','updatedAt']) IS DISTINCT FROM
                        (to_jsonb(OLD) - ARRAY['status','reviewedByUserId','reviewReason','reviewedAt','postedAt','updatedAt']) THEN
    RAISE EXCEPTION 'Reversal request evidence cannot be changed' USING ERRCODE = '23514';
  END IF;
  IF NEW."entityType" = 'clinic' THEN
    SELECT to_jsonb(payment) INTO source_row FROM "ClinicPayment" payment WHERE payment."id" = NEW."entityId" AND payment."tenantId" = NEW."tenantId" FOR UPDATE;
    maker_id := source_row->>'receivedByUserId';
  ELSIF NEW."entityType" = 'pharmacy' THEN
    SELECT to_jsonb(sale) INTO source_row FROM "PharmacySale" sale WHERE sale."id" = NEW."entityId" AND sale."tenantId" = NEW."tenantId" FOR UPDATE;
    maker_id := source_row->>'soldByUserId';
  ELSE
    SELECT to_jsonb(expense) INTO source_row FROM "Expense" expense WHERE expense."id" = NEW."entityId" AND expense."tenantId" = NEW."tenantId" FOR UPDATE;
    maker_id := source_row->>'createdById';
  END IF;
  IF source_row IS NULL OR source_row->>'status' <> (CASE WHEN NEW."entityType" = 'expense' THEN 'posted' ELSE 'paid' END) OR
     NEW."amount" <> COALESCE((source_row->>'amount')::numeric, (source_row->>'total')::numeric) THEN
    RAISE EXCEPTION 'Reversal must match a live entry in the same tenant' USING ERRCODE = '23514';
  END IF;
  IF NEW."sourceDate" IS DISTINCT FROM (COALESCE(source_row->>'expenseDate', source_row->>'paidAt'))::timestamp OR
     NEW."paymentMethod" IS DISTINCT FROM source_row->>'paymentMethod' OR
     NEW."locationId" IS DISTINCT FROM source_row->>'locationId' THEN
    RAISE EXCEPTION 'Reversal must retain original date, method and location' USING ERRCODE = '23514';
  END IF;
  IF NEW."entityType" = 'expense' AND source_row->>'category' = 'supplier_payment' THEN
    RAISE EXCEPTION 'Supplier settlements cannot use operating expense reversals' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM "ClinicCashSession" WHERE "id" = source_row->>'clinicCashSessionId' AND "status" = 'open') OR
     EXISTS (SELECT 1 FROM "PharmacyDailyClosure" WHERE "id" = source_row->>'closureId' AND "status" = 'open') THEN
    RAISE EXCEPTION 'Open-shift entries must use the void workflow' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(SUM("quantity"::numeric * ROUND(COALESCE("unitCost", 0), 2)), 0) INTO expected_cost FROM "PharmacySaleItem"
    WHERE NEW."entityType" = 'pharmacy' AND "saleId" = NEW."entityId" AND "tenantId" = NEW."tenantId";
  IF NEW."costOfGoods" <> expected_cost THEN
    RAISE EXCEPTION 'Reversal cost must match original sale cost' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = NEW."requestedByUserId" AND "tenantId" = NEW."tenantId") OR
     (NEW."reviewedByUserId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = NEW."reviewedByUserId" AND "tenantId" = NEW."tenantId")) THEN
    RAISE EXCEPTION 'Reversal actors must belong to the same tenant' USING ERRCODE = '23514';
  END IF;
  IF NEW."status" = 'approved' THEN
    IF NEW."reviewedByUserId" = maker_id THEN
      RAISE EXCEPTION 'Original maker cannot approve reversal' USING ERRCODE = '23514';
    END IF;
    IF NEW."postedAt"::date <> (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date OR EXISTS (
      SELECT 1 FROM "AccountingPeriod" WHERE "tenantId" = NEW."tenantId" AND NEW."postedAt" BETWEEN "startDate" AND "endDate"
    ) THEN
      RAISE EXCEPTION 'Reversals must post in the current open period' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "guard_financial_reversal" ON "FinancialReversal";
CREATE TRIGGER "guard_financial_reversal" BEFORE INSERT OR UPDATE OR DELETE ON "FinancialReversal" FOR EACH ROW EXECUTE FUNCTION pharma_guard_financial_reversal();

COMMIT;
