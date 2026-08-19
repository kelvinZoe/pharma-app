CREATE TABLE IF NOT EXISTS "PharmacyLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "licenceNumber" TEXT,
    "supervisingPharmacistId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "PharmacyLocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacyLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyLocation_supervisingPharmacistId_fkey" FOREIGN KEY ("supervisingPharmacistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UserPharmacyLocation" (
    "id" TEXT NOT NULL,
    "role" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    CONSTRAINT "UserPharmacyLocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserPharmacyLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserPharmacyLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserPharmacyLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyLocation_tenantId_code_key" ON "PharmacyLocation"("tenantId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyLocation_tenantId_name_key" ON "PharmacyLocation"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "PharmacyLocation_tenantId_isActive_idx" ON "PharmacyLocation"("tenantId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "UserPharmacyLocation_userId_locationId_key" ON "UserPharmacyLocation"("userId", "locationId");
CREATE INDEX IF NOT EXISTS "UserPharmacyLocation_tenantId_userId_isActive_idx" ON "UserPharmacyLocation"("tenantId", "userId", "isActive");
CREATE INDEX IF NOT EXISTS "UserPharmacyLocation_tenantId_locationId_isActive_idx" ON "UserPharmacyLocation"("tenantId", "locationId", "isActive");

ALTER TABLE "PharmacyBatch" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PharmacyBatch" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "PharmacyStockMovement" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PharmacyStockMovement" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "PharmacySale" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "PharmacySaleItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "PharmacySaleItem" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "PharmacyDailyClosure" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "PharmacySale" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE "PharmacySale" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE "PharmacySaleItem" ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL;
ALTER TABLE "PharmacyDailyClosure" ADD COLUMN IF NOT EXISTS "expectedCash" DECIMAL;
ALTER TABLE "PharmacyDailyClosure" ADD COLUMN IF NOT EXISTS "expectedMomo" DECIMAL;

INSERT INTO "PharmacyLocation" ("id", "code", "name", "isActive", "createdAt", "updatedAt", "tenantId")
SELECT gen_random_uuid()::text, 'MAIN', 'Main Pharmacy', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, tenant."id"
FROM "Tenant" tenant
WHERE NOT EXISTS (
    SELECT 1 FROM "PharmacyLocation" location
    WHERE location."tenantId" = tenant."id"
);

UPDATE "PharmacyBatch" batch
SET "tenantId" = product."tenantId", "locationId" = location."id"
FROM "PharmacyProduct" product
JOIN "PharmacyLocation" location ON location."tenantId" = product."tenantId" AND location."code" = 'MAIN'
WHERE batch."productId" = product."id"
  AND (batch."tenantId" IS NULL OR batch."locationId" IS NULL);

UPDATE "PharmacyStockMovement" movement
SET "tenantId" = product."tenantId", "locationId" = location."id"
FROM "PharmacyProduct" product
JOIN "PharmacyLocation" location ON location."tenantId" = product."tenantId" AND location."code" = 'MAIN'
WHERE movement."productId" = product."id"
  AND (movement."tenantId" IS NULL OR movement."locationId" IS NULL);

UPDATE "PharmacySale" sale
SET "locationId" = location."id"
FROM "PharmacyLocation" location
WHERE location."tenantId" = sale."tenantId"
  AND location."code" = 'MAIN'
  AND sale."locationId" IS NULL;

UPDATE "PharmacySaleItem" item
SET "tenantId" = sale."tenantId", "locationId" = sale."locationId"
FROM "PharmacySale" sale
WHERE item."saleId" = sale."id"
  AND (item."tenantId" IS NULL OR item."locationId" IS NULL);

UPDATE "PharmacyDailyClosure" closure
SET "locationId" = location."id"
FROM "PharmacyLocation" location
WHERE location."tenantId" = closure."tenantId"
  AND location."code" = 'MAIN'
  AND closure."locationId" IS NULL;

INSERT INTO "UserPharmacyLocation" (
    "id", "role", "isDefault", "isActive", "createdAt", "updatedAt", "tenantId", "userId", "locationId"
)
SELECT
    gen_random_uuid()::text,
    CASE WHEN user_record."role" = 0 THEN 'admin' ELSE 'pharmacy' END,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    user_record."tenantId",
    user_record."id",
    location."id"
FROM "User" user_record
JOIN "PharmacyLocation" location ON location."tenantId" = user_record."tenantId" AND location."code" = 'MAIN'
WHERE user_record."tenantId" IS NOT NULL
  AND (
    user_record."role" IN (0, 4)
    OR '0' = ANY(string_to_array(COALESCE(user_record."roles", ''), ','))
    OR '4' = ANY(string_to_array(COALESCE(user_record."roles", ''), ','))
  )
  AND NOT EXISTS (
    SELECT 1 FROM "UserPharmacyLocation" membership
    WHERE membership."userId" = user_record."id" AND membership."locationId" = location."id"
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyBatch_tenantId_fkey') THEN
    ALTER TABLE "PharmacyBatch" ADD CONSTRAINT "PharmacyBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyBatch_locationId_fkey') THEN
    ALTER TABLE "PharmacyBatch" ADD CONSTRAINT "PharmacyBatch_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyStockMovement_tenantId_fkey') THEN
    ALTER TABLE "PharmacyStockMovement" ADD CONSTRAINT "PharmacyStockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyStockMovement_locationId_fkey') THEN
    ALTER TABLE "PharmacyStockMovement" ADD CONSTRAINT "PharmacyStockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacySale_locationId_fkey') THEN
    ALTER TABLE "PharmacySale" ADD CONSTRAINT "PharmacySale_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacySaleItem_tenantId_fkey') THEN
    ALTER TABLE "PharmacySaleItem" ADD CONSTRAINT "PharmacySaleItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacySaleItem_locationId_fkey') THEN
    ALTER TABLE "PharmacySaleItem" ADD CONSTRAINT "PharmacySaleItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyDailyClosure_locationId_fkey') THEN
    ALTER TABLE "PharmacyDailyClosure" ADD CONSTRAINT "PharmacyDailyClosure_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyBatch_locationId_productId_batchNumber_key" ON "PharmacyBatch"("locationId", "productId", "batchNumber");
CREATE INDEX IF NOT EXISTS "PharmacyBatch_tenantId_locationId_expiryDate_idx" ON "PharmacyBatch"("tenantId", "locationId", "expiryDate");
CREATE INDEX IF NOT EXISTS "PharmacyStockMovement_tenantId_locationId_createdAt_idx" ON "PharmacyStockMovement"("tenantId", "locationId", "createdAt");
CREATE INDEX IF NOT EXISTS "PharmacyStockMovement_tenantId_locationId_productId_idx" ON "PharmacyStockMovement"("tenantId", "locationId", "productId");
CREATE INDEX IF NOT EXISTS "PharmacySale_tenantId_locationId_paidAt_idx" ON "PharmacySale"("tenantId", "locationId", "paidAt");
CREATE INDEX IF NOT EXISTS "PharmacySaleItem_tenantId_locationId_createdAt_idx" ON "PharmacySaleItem"("tenantId", "locationId", "createdAt");
CREATE INDEX IF NOT EXISTS "PharmacyDailyClosure_tenantId_locationId_status_idx" ON "PharmacyDailyClosure"("tenantId", "locationId", "status");

SELECT
  tenant."id" AS "tenantId",
  tenant."name" AS "tenantName",
  COUNT(DISTINCT location."id") AS "locationCount",
  COUNT(DISTINCT batch."id") FILTER (WHERE batch."locationId" IS NULL) AS "unscopedBatches",
  COUNT(DISTINCT sale."id") FILTER (WHERE sale."locationId" IS NULL) AS "unscopedSales",
  COUNT(DISTINCT closure."id") FILTER (WHERE closure."locationId" IS NULL) AS "unscopedClosures"
FROM "Tenant" tenant
LEFT JOIN "PharmacyLocation" location ON location."tenantId" = tenant."id"
LEFT JOIN "PharmacyProduct" product ON product."tenantId" = tenant."id"
LEFT JOIN "PharmacyBatch" batch ON batch."productId" = product."id"
LEFT JOIN "PharmacySale" sale ON sale."tenantId" = tenant."id"
LEFT JOIN "PharmacyDailyClosure" closure ON closure."tenantId" = tenant."id"
GROUP BY tenant."id", tenant."name"
ORDER BY tenant."name";
