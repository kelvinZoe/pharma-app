ALTER TABLE "VisitService"
ADD COLUMN IF NOT EXISTS "requestedLineTotal" DECIMAL,
ADD COLUMN IF NOT EXISTS "priceAdjustmentReason" TEXT,
ADD COLUMN IF NOT EXISTS "priceAdjustmentStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS "priceAdjustedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "priceAdjustedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "priceApprovedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "priceApprovedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "VisitService_priceAdjustmentStatus_idx"
ON "VisitService"("priceAdjustmentStatus");
