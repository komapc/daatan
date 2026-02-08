-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'RESOLVER', 'ADMIN');

-- AlterTable
ALTER TABLE "forecasts" ALTER COLUMN "slug" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "predictions" ALTER COLUMN "slug" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ALTER COLUMN "slug" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "comments_predictionId_createdAt_idx" ON "comments"("predictionId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_forecastId_createdAt_idx" ON "comments"("forecastId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_deletedAt_idx" ON "comments"("deletedAt");


-- Data Migration
UPDATE "users" SET "role" = 'ADMIN' WHERE "isAdmin" = true;
UPDATE "users" SET "role" = 'RESOLVER' WHERE "isModerator" = true AND "isAdmin" = false;
