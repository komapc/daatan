-- DropIndex
DROP INDEX IF EXISTS "comments_forecastId_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "comments_forecastId_idx";

-- AlterTable - Drop forecastId column (safe, comments on forecasts will be lost)
ALTER TABLE "comments" DROP COLUMN "forecastId";
