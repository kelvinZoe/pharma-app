CREATE TABLE IF NOT EXISTS "PharmacyMedicine" (
    "id" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "dosageForm" TEXT NOT NULL,
    "strengthValue" DECIMAL(18,6),
    "strengthUnit" TEXT,
    "strengthPerValue" DECIMAL(18,6),
    "strengthPerUnit" TEXT,
    "strengthDisplay" TEXT,
    "routeOfAdministration" TEXT,
    "therapeuticClass" TEXT,
    "prescriptionCategory" TEXT NOT NULL DEFAULT 'OTC',
    "description" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'active',
    "catalogueIdentity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "PharmacyMedicine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacyMedicine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyMedicine_tenantId_catalogueIdentity_key"
ON "PharmacyMedicine"("tenantId", "catalogueIdentity");
CREATE INDEX IF NOT EXISTS "PharmacyMedicine_tenantId_genericName_idx"
ON "PharmacyMedicine"("tenantId", "genericName");
CREATE INDEX IF NOT EXISTS "PharmacyMedicine_tenantId_lifecycleStatus_idx"
ON "PharmacyMedicine"("tenantId", "lifecycleStatus");

ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "medicineId" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "packageType" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "packageQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "packageUnit" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "packageSizeValue" DECIMAL(18,6);
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "packageSizeUnit" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "sellingUnit" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "allowLooseSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "minimumSaleQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1;

ALTER TABLE "PharmacyLocationProduct" ADD COLUMN IF NOT EXISTS "isAvailableForSale" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PharmacyLocationProduct" ADD COLUMN IF NOT EXISTS "allowLooseSale" BOOLEAN;
ALTER TABLE "PharmacyLocationProduct" ADD COLUMN IF NOT EXISTS "minimumSaleQuantity" DOUBLE PRECISION;

INSERT INTO "PharmacyMedicine" (
    "id", "genericName", "dosageForm", "strengthDisplay", "routeOfAdministration",
    "therapeuticClass", "prescriptionCategory", "description", "lifecycleStatus",
    "catalogueIdentity", "createdAt", "updatedAt", "tenantId"
)
SELECT
    gen_random_uuid()::text,
    COALESCE(NULLIF(TRIM(product."genericName"), ''), product."name"),
    COALESCE(NULLIF(TRIM(product."dosageForm"), ''), 'Other'),
    NULLIF(TRIM(product."strength"), ''),
    product."routeOfAdministration",
    product."therapeuticClass",
    CASE WHEN product."prescriptionRequired" THEN 'POM' ELSE 'OTC' END,
    product."description",
    product."lifecycleStatus",
    product."id",
    product."createdAt",
    CURRENT_TIMESTAMP,
    product."tenantId"
FROM "PharmacyProduct" product
WHERE product."tenantId" IS NOT NULL
  AND product."medicineId" IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM "PharmacyMedicine" medicine
      WHERE medicine."tenantId" = product."tenantId"
        AND medicine."catalogueIdentity" = product."id"
  );

UPDATE "PharmacyProduct" product
SET
    "medicineId" = medicine."id",
    "packageType" = COALESCE(product."packageType", product."defaultPurchaseUnit", 'unit'),
    "packageQuantity" = CASE WHEN product."packageType" IS NULL THEN COALESCE(product."defaultUnitsPerPack", 1) ELSE product."packageQuantity" END,
    "packageUnit" = COALESCE(product."packageUnit", product."unitOfMeasure"),
    "sellingUnit" = COALESCE(product."sellingUnit", product."unitOfMeasure"),
    "allowLooseSale" = CASE
        WHEN COALESCE(product."defaultUnitsPerPack", 1) > 1 THEN true
        ELSE product."allowLooseSale"
    END
FROM "PharmacyMedicine" medicine
WHERE product."tenantId" = medicine."tenantId"
  AND medicine."catalogueIdentity" = product."id"
  AND product."medicineId" IS NULL;

CREATE INDEX IF NOT EXISTS "PharmacyProduct_tenantId_medicineId_idx"
ON "PharmacyProduct"("tenantId", "medicineId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyProduct_medicineId_fkey'
    ) THEN
        ALTER TABLE "PharmacyProduct"
        ADD CONSTRAINT "PharmacyProduct_medicineId_fkey"
        FOREIGN KEY ("medicineId") REFERENCES "PharmacyMedicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
