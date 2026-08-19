ALTER TABLE "Expense"
  ADD COLUMN IF NOT EXISTS "payee" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "costCenter" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'posted',
  ADD COLUMN IF NOT EXISTS "voidReason" TEXT,
  ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voidedByUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Expense_voidedByUserId_fkey'
  ) THEN
    ALTER TABLE "Expense"
      ADD CONSTRAINT "Expense_voidedByUserId_fkey"
      FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Expense_tenantId_status_expenseDate_idx"
  ON "Expense"("tenantId", "status", "expenseDate");
