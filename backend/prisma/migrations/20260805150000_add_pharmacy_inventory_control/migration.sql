ALTER TABLE "PharmacyStockMovement" ADD COLUMN IF NOT EXISTS "quantityBefore" DOUBLE PRECISION;
ALTER TABLE "PharmacyStockMovement" ADD COLUMN IF NOT EXISTS "quantityAfter" DOUBLE PRECISION;
ALTER TABLE "PharmacyStockMovement" ADD COLUMN IF NOT EXISTS "referenceType" TEXT;
ALTER TABLE "PharmacyStockMovement" ADD COLUMN IF NOT EXISTS "reason" TEXT;

CREATE TABLE IF NOT EXISTS "PharmacyStockCount" (
  "id" TEXT NOT NULL, "countNumber" TEXT NOT NULL, "countType" TEXT NOT NULL DEFAULT 'cycle', "status" TEXT NOT NULL DEFAULT 'counting',
  "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "submittedAt" TIMESTAMP(3), "approvedAt" TIMESTAMP(3), "postedAt" TIMESTAMP(3),
  "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL, "locationId" TEXT NOT NULL, "createdByUserId" TEXT NOT NULL, "approvedByUserId" TEXT,
  CONSTRAINT "PharmacyStockCount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PharmacyStockCount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockCount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockCount_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockCount_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PharmacyStockCountLine" (
  "id" TEXT NOT NULL, "expectedQty" DOUBLE PRECISION NOT NULL, "countedQty" DOUBLE PRECISION, "varianceQty" DOUBLE PRECISION,
  "unitCost" DECIMAL NOT NULL, "varianceCost" DECIMAL, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "tenantId" TEXT NOT NULL, "countId" TEXT NOT NULL, "productId" TEXT NOT NULL, "batchId" TEXT NOT NULL,
  CONSTRAINT "PharmacyStockCountLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PharmacyStockCountLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "PharmacyStockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockCountLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PharmacyProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockCountLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PharmacyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PharmacyStockAdjustment" (
  "id" TEXT NOT NULL, "adjustmentNumber" TEXT NOT NULL, "adjustmentType" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending',
  "quantity" DOUBLE PRECISION NOT NULL, "quantityBefore" DOUBLE PRECISION, "quantityAfter" DOUBLE PRECISION, "unitCost" DECIMAL NOT NULL,
  "reason" TEXT NOT NULL, "notes" TEXT, "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "approvedAt" TIMESTAMP(3),
  "postedAt" TIMESTAMP(3), "rejectedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "tenantId" TEXT NOT NULL, "locationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL, "batchId" TEXT NOT NULL, "stockCountId" TEXT, "stockCountLineId" TEXT, "createdByUserId" TEXT NOT NULL, "approvedByUserId" TEXT,
  CONSTRAINT "PharmacyStockAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PharmacyStockAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockAdjustment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PharmacyProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockAdjustment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PharmacyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockAdjustment_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "PharmacyStockCount"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockAdjustment_stockCountLineId_fkey" FOREIGN KEY ("stockCountLineId") REFERENCES "PharmacyStockCountLine"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyStockAdjustment_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyStockCount_tenantId_countNumber_key" ON "PharmacyStockCount"("tenantId", "countNumber");
CREATE INDEX IF NOT EXISTS "PharmacyStockCount_tenantId_locationId_status_createdAt_idx" ON "PharmacyStockCount"("tenantId", "locationId", "status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyStockCountLine_countId_batchId_key" ON "PharmacyStockCountLine"("countId", "batchId");
CREATE INDEX IF NOT EXISTS "PharmacyStockCountLine_tenantId_countId_idx" ON "PharmacyStockCountLine"("tenantId", "countId");
CREATE INDEX IF NOT EXISTS "PharmacyStockCountLine_tenantId_productId_idx" ON "PharmacyStockCountLine"("tenantId", "productId");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyStockAdjustment_stockCountLineId_key" ON "PharmacyStockAdjustment"("stockCountLineId");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyStockAdjustment_tenantId_adjustmentNumber_key" ON "PharmacyStockAdjustment"("tenantId", "adjustmentNumber");
CREATE INDEX IF NOT EXISTS "PharmacyStockAdjustment_tenantId_locationId_status_requestedAt_idx" ON "PharmacyStockAdjustment"("tenantId", "locationId", "status", "requestedAt");
CREATE INDEX IF NOT EXISTS "PharmacyStockAdjustment_tenantId_productId_batchId_idx" ON "PharmacyStockAdjustment"("tenantId", "productId", "batchId");
