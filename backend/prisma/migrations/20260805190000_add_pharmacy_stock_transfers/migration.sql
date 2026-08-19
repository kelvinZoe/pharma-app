ALTER TABLE "PharmacyBatch"
ADD COLUMN IF NOT EXISTS "quantityReserved" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PharmacyTransfer" (
  "id" TEXT NOT NULL,
  "transferNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "dispatchNotes" TEXT,
  "receiptNotes" TEXT,
  "discrepancyNotes" TEXT,
  "transporterName" TEXT,
  "transporterPhone" TEXT,
  "vehicleReference" TEXT,
  "requestedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "dispatchedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "sourceLocationId" TEXT NOT NULL,
  "destinationLocationId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "dispatchedByUserId" TEXT,
  "receivedByUserId" TEXT,
  "resolvedByUserId" TEXT,
  CONSTRAINT "PharmacyTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PharmacyTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransfer_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransfer_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "PharmacyLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransfer_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransfer_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransfer_dispatchedByUserId_fkey" FOREIGN KEY ("dispatchedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransfer_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransfer_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransfer_different_locations_check" CHECK ("sourceLocationId" <> "destinationLocationId")
);

CREATE TABLE IF NOT EXISTS "PharmacyTransferLine" (
  "id" TEXT NOT NULL,
  "requestedQty" DOUBLE PRECISION NOT NULL,
  "approvedQty" DOUBLE PRECISION,
  "dispatchedQty" DOUBLE PRECISION,
  "receivedQty" DOUBLE PRECISION,
  "rejectedQty" DOUBLE PRECISION,
  "unitCost" DECIMAL NOT NULL,
  "sellingPrice" DECIMAL NOT NULL,
  "batchNumber" TEXT NOT NULL,
  "expiryDate" TIMESTAMP(3) NOT NULL,
  "discrepancyReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sourceBatchId" TEXT NOT NULL,
  "destinationBatchId" TEXT,
  CONSTRAINT "PharmacyTransferLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PharmacyTransferLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "PharmacyTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransferLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PharmacyProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransferLine_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "PharmacyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransferLine_destinationBatchId_fkey" FOREIGN KEY ("destinationBatchId") REFERENCES "PharmacyBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PharmacyTransferLine_positive_request_check" CHECK ("requestedQty" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyTransfer_tenantId_transferNumber_key"
ON "PharmacyTransfer"("tenantId", "transferNumber");
CREATE INDEX IF NOT EXISTS "PharmacyTransfer_tenantId_sourceLocationId_status_createdAt_idx"
ON "PharmacyTransfer"("tenantId", "sourceLocationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PharmacyTransfer_tenantId_destinationLocationId_status_createdAt_idx"
ON "PharmacyTransfer"("tenantId", "destinationLocationId", "status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyTransferLine_transferId_sourceBatchId_key"
ON "PharmacyTransferLine"("transferId", "sourceBatchId");
CREATE INDEX IF NOT EXISTS "PharmacyTransferLine_tenantId_transferId_idx"
ON "PharmacyTransferLine"("tenantId", "transferId");
CREATE INDEX IF NOT EXISTS "PharmacyTransferLine_tenantId_productId_sourceBatchId_idx"
ON "PharmacyTransferLine"("tenantId", "productId", "sourceBatchId");
