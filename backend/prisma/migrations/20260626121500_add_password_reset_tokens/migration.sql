ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT,
ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_passwordResetToken_key"
ON "User"("passwordResetToken")
WHERE "passwordResetToken" IS NOT NULL;
