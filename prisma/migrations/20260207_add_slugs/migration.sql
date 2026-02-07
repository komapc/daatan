-- Add slug fields to User, Prediction, and Forecast tables
-- AlterTable
ALTER TABLE "users" ADD COLUMN "slug" VARCHAR(255);

-- AlterTable
ALTER TABLE "predictions" ADD COLUMN "slug" VARCHAR(255);

-- AlterTable
ALTER TABLE "forecasts" ADD COLUMN "slug" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "users_slug_key" ON "users"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_slug_key" ON "predictions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "forecasts_slug_key" ON "forecasts"("slug");
