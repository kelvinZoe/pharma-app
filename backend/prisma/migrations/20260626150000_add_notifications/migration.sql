CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'info',
  "module" TEXT,
  "targetRole" INTEGER,
  "targetUserId" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "route" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_tenantId_fkey'
  ) THEN
    ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_tenantId_targetRole_isRead_idx"
ON "Notification"("tenantId", "targetRole", "isRead");

CREATE INDEX IF NOT EXISTS "Notification_tenantId_targetUserId_isRead_idx"
ON "Notification"("tenantId", "targetUserId", "isRead");

CREATE INDEX IF NOT EXISTS "Notification_tenantId_createdAt_idx"
ON "Notification"("tenantId", "createdAt");
