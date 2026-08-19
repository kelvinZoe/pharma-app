CREATE TABLE IF NOT EXISTS "PharmacyPurchaseOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDeliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "subtotal" DECIMAL NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    CONSTRAINT "PharmacyPurchaseOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacyPurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseOrder_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "PharmacySupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseOrder_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseOrder_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PharmacyPurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseUnit" TEXT NOT NULL DEFAULT 'box',
    "orderedPacks" DOUBLE PRECISION NOT NULL,
    "unitsPerPack" DOUBLE PRECISION NOT NULL,
    "orderedUnits" DOUBLE PRECISION NOT NULL,
    "unitCostPerPack" DECIMAL NOT NULL,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL NOT NULL,
    "receivedUnits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "PharmacyPurchaseOrderLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PharmacyPurchaseOrderLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PharmacyPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PharmacyPurchaseOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PharmacyProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyPurchaseOrder_tenantId_orderNumber_key" ON "PharmacyPurchaseOrder"("tenantId", "orderNumber");
CREATE INDEX IF NOT EXISTS "PharmacyPurchaseOrder_tenantId_locationId_status_orderDate_idx" ON "PharmacyPurchaseOrder"("tenantId", "locationId", "status", "orderDate");
CREATE INDEX IF NOT EXISTS "PharmacyPurchaseOrder_tenantId_supplierId_orderDate_idx" ON "PharmacyPurchaseOrder"("tenantId", "supplierId", "orderDate");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyPurchaseOrderLine_purchaseOrderId_productId_key" ON "PharmacyPurchaseOrderLine"("purchaseOrderId", "productId");
CREATE INDEX IF NOT EXISTS "PharmacyPurchaseOrderLine_tenantId_purchaseOrderId_idx" ON "PharmacyPurchaseOrderLine"("tenantId", "purchaseOrderId");
CREATE INDEX IF NOT EXISTS "PharmacyPurchaseOrderLine_tenantId_productId_idx" ON "PharmacyPurchaseOrderLine"("tenantId", "productId");

ALTER TABLE "PharmacyGoodsReceipt" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;
ALTER TABLE "PharmacyGoodsReceiptLine" ADD COLUMN IF NOT EXISTS "purchaseOrderLineId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyGoodsReceipt_purchaseOrderId_fkey') THEN
        ALTER TABLE "PharmacyGoodsReceipt" ADD CONSTRAINT "PharmacyGoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PharmacyPurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyGoodsReceiptLine_purchaseOrderLineId_fkey') THEN
        ALTER TABLE "PharmacyGoodsReceiptLine" ADD CONSTRAINT "PharmacyGoodsReceiptLine_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PharmacyPurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PharmacyGoodsReceipt_tenantId_purchaseOrderId_receivedAt_idx" ON "PharmacyGoodsReceipt"("tenantId", "purchaseOrderId", "receivedAt");
CREATE INDEX IF NOT EXISTS "PharmacyGoodsReceiptLine_tenantId_purchaseOrderLineId_idx" ON "PharmacyGoodsReceiptLine"("tenantId", "purchaseOrderLineId");
