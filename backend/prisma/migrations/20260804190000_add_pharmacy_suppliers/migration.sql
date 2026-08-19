CREATE TABLE IF NOT EXISTS "PharmacySupplier" (
    "id" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "PharmacySupplier_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacySupplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacySupplier_tenantId_supplierCode_key"
ON "PharmacySupplier"("tenantId", "supplierCode");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacySupplier_tenantId_normalizedName_key"
ON "PharmacySupplier"("tenantId", "normalizedName");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacySupplier_tenantId_taxId_key"
ON "PharmacySupplier"("tenantId", "taxId");
CREATE INDEX IF NOT EXISTS "PharmacySupplier_tenantId_isActive_name_idx"
ON "PharmacySupplier"("tenantId", "isActive", "name");

ALTER TABLE "PharmacyGoodsReceipt" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

WITH distinct_suppliers AS (
    SELECT DISTINCT ON (
        "tenantId",
        LOWER(REGEXP_REPLACE(TRIM("supplierName"), '[^a-zA-Z0-9]+', '', 'g'))
    )
        "tenantId",
        TRIM("supplierName") AS supplier_name,
        LOWER(REGEXP_REPLACE(TRIM("supplierName"), '[^a-zA-Z0-9]+', '', 'g')) AS normalized_name
    FROM "PharmacyGoodsReceipt"
    WHERE "supplierName" IS NOT NULL AND TRIM("supplierName") <> ''
    ORDER BY
        "tenantId",
        LOWER(REGEXP_REPLACE(TRIM("supplierName"), '[^a-zA-Z0-9]+', '', 'g')),
        "receivedAt"
)
INSERT INTO "PharmacySupplier" (
    "id", "supplierCode", "name", "normalizedName", "isActive", "createdAt", "updatedAt", "tenantId"
)
SELECT
    gen_random_uuid()::text,
    'SUP-' || UPPER(SUBSTRING(MD5(supplier."tenantId" || supplier.normalized_name), 1, 8)),
    supplier.supplier_name,
    supplier.normalized_name,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    supplier."tenantId"
FROM distinct_suppliers supplier
ON CONFLICT ("tenantId", "normalizedName") DO NOTHING;

UPDATE "PharmacyGoodsReceipt" receipt
SET "supplierId" = supplier."id"
FROM "PharmacySupplier" supplier
WHERE receipt."supplierId" IS NULL
  AND receipt."tenantId" = supplier."tenantId"
  AND receipt."supplierName" IS NOT NULL
  AND LOWER(REGEXP_REPLACE(TRIM(receipt."supplierName"), '[^a-zA-Z0-9]+', '', 'g')) = supplier."normalizedName";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyGoodsReceipt_supplierId_fkey'
    ) THEN
        ALTER TABLE "PharmacyGoodsReceipt"
        ADD CONSTRAINT "PharmacyGoodsReceipt_supplierId_fkey"
        FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PharmacyGoodsReceipt_tenantId_supplierId_receivedAt_idx"
ON "PharmacyGoodsReceipt"("tenantId", "supplierId", "receivedAt");
