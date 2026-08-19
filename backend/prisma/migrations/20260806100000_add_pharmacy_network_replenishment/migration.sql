ALTER TABLE "PharmacyBatch"
ADD COLUMN IF NOT EXISTS "quantityQuarantined" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "PharmacyLocationProduct"
ADD COLUMN IF NOT EXISTS "safetyStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "maximumStock" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "supplierLeadTimeDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS "targetCoverDays" INTEGER NOT NULL DEFAULT 14;

ALTER TABLE "PharmacyTransfer"
ADD COLUMN IF NOT EXISTS "fefoOverrideReason" TEXT;

ALTER TABLE "PharmacyTransferLine"
ADD COLUMN IF NOT EXISTS "quarantinedQty" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "conditionStatus" TEXT,
ADD COLUMN IF NOT EXISTS "storageInstructions" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyBatch_quantityQuarantined_check') THEN
    ALTER TABLE "PharmacyBatch"
    ADD CONSTRAINT "PharmacyBatch_quantityQuarantined_check"
    CHECK ("quantityQuarantined" >= 0 AND "quantityQuarantined" <= "quantityRemaining");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyLocationProduct_inventoryPolicy_check') THEN
    ALTER TABLE "PharmacyLocationProduct"
    ADD CONSTRAINT "PharmacyLocationProduct_inventoryPolicy_check"
    CHECK (
      "reorderLevel" >= 0
      AND "safetyStock" >= 0
      AND ("maximumStock" IS NULL OR "maximumStock" >= "reorderLevel" + "safetyStock")
      AND "supplierLeadTimeDays" >= 0
      AND "targetCoverDays" >= 1
    );
  END IF;
END $$;
