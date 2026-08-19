ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "genericName" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "brandName" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "strength" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "dosageForm" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
ALTER TABLE "PharmacyProduct" ADD COLUMN IF NOT EXISTS "barcode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyProduct_tenantId_barcode_key"
ON "PharmacyProduct"("tenantId", "barcode");
CREATE INDEX IF NOT EXISTS "PharmacyProduct_tenantId_name_idx"
ON "PharmacyProduct"("tenantId", "name");

CREATE TABLE IF NOT EXISTS "PharmacyLocationProduct" (
    "id" TEXT NOT NULL,
    "reorderLevel" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "shelfLocation" TEXT,
    "defaultSellingPrice" DECIMAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "PharmacyLocationProduct_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacyLocationProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyLocationProduct_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyLocationProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PharmacyProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyLocationProduct_locationId_productId_key"
ON "PharmacyLocationProduct"("locationId", "productId");
CREATE INDEX IF NOT EXISTS "PharmacyLocationProduct_tenantId_locationId_isActive_idx"
ON "PharmacyLocationProduct"("tenantId", "locationId", "isActive");

CREATE TABLE IF NOT EXISTS "PharmacyGoodsReceipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "supplierName" TEXT,
    "supplierInvoiceNumber" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "notes" TEXT,
    "totalCost" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    CONSTRAINT "PharmacyGoodsReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacyGoodsReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyGoodsReceipt_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacyGoodsReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyGoodsReceipt_tenantId_receiptNumber_key"
ON "PharmacyGoodsReceipt"("tenantId", "receiptNumber");
CREATE INDEX IF NOT EXISTS "PharmacyGoodsReceipt_tenantId_locationId_receivedAt_idx"
ON "PharmacyGoodsReceipt"("tenantId", "locationId", "receivedAt");

CREATE TABLE IF NOT EXISTS "PharmacyGoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "purchaseUnit" TEXT NOT NULL DEFAULT 'unit',
    "packQuantity" DOUBLE PRECISION NOT NULL,
    "unitsPerPack" DOUBLE PRECISION NOT NULL,
    "quantityReceived" DOUBLE PRECISION NOT NULL,
    "purchasePricePerPack" DECIMAL NOT NULL,
    "unitCost" DECIMAL NOT NULL,
    "sellingPrice" DECIMAL NOT NULL,
    "lineTotal" DECIMAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    CONSTRAINT "PharmacyGoodsReceiptLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacyGoodsReceiptLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyGoodsReceiptLine_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacyGoodsReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PharmacyGoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyGoodsReceiptLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PharmacyProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacyGoodsReceiptLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PharmacyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyGoodsReceiptLine_batchId_key"
ON "PharmacyGoodsReceiptLine"("batchId");
CREATE INDEX IF NOT EXISTS "PharmacyGoodsReceiptLine_tenantId_locationId_createdAt_idx"
ON "PharmacyGoodsReceiptLine"("tenantId", "locationId", "createdAt");
CREATE INDEX IF NOT EXISTS "PharmacyGoodsReceiptLine_tenantId_receiptId_idx"
ON "PharmacyGoodsReceiptLine"("tenantId", "receiptId");

INSERT INTO "PharmacyLocationProduct" (
    "id", "reorderLevel", "isActive", "createdAt", "updatedAt", "tenantId", "locationId", "productId"
)
SELECT
    gen_random_uuid()::text,
    product."reorderLevel",
    product."isActive",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    product."tenantId",
    location."id",
    product."id"
FROM "PharmacyProduct" product
JOIN "PharmacyLocation" location ON location."tenantId" = product."tenantId"
WHERE product."tenantId" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "PharmacyLocationProduct" setting
      WHERE setting."locationId" = location."id"
        AND setting."productId" = product."id"
  );

SELECT
    (SELECT COUNT(*) FROM "PharmacyLocationProduct") AS "locationProductCount",
    (SELECT COUNT(*) FROM "PharmacyGoodsReceipt") AS "goodsReceiptCount";
