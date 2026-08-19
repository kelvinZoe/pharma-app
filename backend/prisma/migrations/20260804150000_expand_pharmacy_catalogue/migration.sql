ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "routeOfAdministration" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "therapeuticClass" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "prescriptionRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "controlledClassification" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "taxCategory" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "isTaxExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "storageInstructions" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "lifecycleStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "defaultPurchaseUnit" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "defaultUnitsPerPack" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "catalogueIdentity" TEXT;

WITH normalized_products AS (
    SELECT
        "id",
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF("genericName", ''), "name")), '[^a-zA-Z0-9]+', '', 'g')) || '|' ||
        LOWER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF("brandName", ''), NULLIF("manufacturer", ''), 'generic')), '[^a-zA-Z0-9]+', '', 'g')) || '|' ||
        LOWER(REGEXP_REPLACE(TRIM(COALESCE("strength", '')), '[^a-zA-Z0-9]+', '', 'g')) || '|' ||
        LOWER(REGEXP_REPLACE(TRIM(COALESCE("dosageForm", '')), '[^a-zA-Z0-9]+', '', 'g')) || '|' ||
        LOWER(REGEXP_REPLACE(TRIM(COALESCE("unitOfMeasure", '')), '[^a-zA-Z0-9]+', '', 'g')) AS base_identity,
        ROW_NUMBER() OVER (
            PARTITION BY
                "tenantId",
                LOWER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF("genericName", ''), "name")), '[^a-zA-Z0-9]+', '', 'g')),
                LOWER(REGEXP_REPLACE(TRIM(COALESCE(NULLIF("brandName", ''), NULLIF("manufacturer", ''), 'generic')), '[^a-zA-Z0-9]+', '', 'g')),
                LOWER(REGEXP_REPLACE(TRIM(COALESCE("strength", '')), '[^a-zA-Z0-9]+', '', 'g')),
                LOWER(REGEXP_REPLACE(TRIM(COALESCE("dosageForm", '')), '[^a-zA-Z0-9]+', '', 'g')),
                LOWER(REGEXP_REPLACE(TRIM(COALESCE("unitOfMeasure", '')), '[^a-zA-Z0-9]+', '', 'g'))
            ORDER BY "createdAt", "id"
        ) AS duplicate_number
    FROM "PharmacyProduct"
)
UPDATE "PharmacyProduct" product
SET "catalogueIdentity" = CASE
    WHEN normalized.duplicate_number = 1 THEN normalized.base_identity
    ELSE normalized.base_identity || '|legacy:' || product."id"
END
FROM normalized_products normalized
WHERE product."id" = normalized."id"
  AND product."catalogueIdentity" IS NULL;

UPDATE "PharmacyProduct"
SET "lifecycleStatus" = CASE WHEN "isActive" THEN 'active' ELSE 'archived' END
WHERE "lifecycleStatus" = 'active' AND "isActive" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyProduct_tenantId_catalogueIdentity_key"
ON "PharmacyProduct"("tenantId", "catalogueIdentity");

CREATE INDEX IF NOT EXISTS "PharmacyProduct_tenantId_lifecycleStatus_idx"
ON "PharmacyProduct"("tenantId", "lifecycleStatus");
