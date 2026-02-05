-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twitterHandle" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailNotifications" BOOLEAN NOT NULL DEFAULT true;

-- Drop bio column if it exists
ALTER TABLE "users" DROP COLUMN IF EXISTS "bio";
