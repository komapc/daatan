-- AlterTable: Add isPublic and shareToken to predictions
ALTER TABLE "predictions" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "predictions" ADD COLUMN "shareToken" TEXT;

-- Backfill shareToken for existing rows
UPDATE "predictions"
SET "shareToken" = substr(md5("id" || "createdAt"::text), 1, 16)
WHERE "shareToken" IS NULL;

-- Make shareToken NOT NULL after backfill
ALTER TABLE "predictions" ALTER COLUMN "shareToken" SET NOT NULL;

-- Add unique constraint and index
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_shareToken_key" UNIQUE ("shareToken");
CREATE INDEX "predictions_isPublic_idx" ON "predictions"("isPublic");
