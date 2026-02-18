/*
  Warnings:

  - You are about to drop the column `forecastId` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the `forecast_options` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `forecasts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `votes` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `predictionId` on table `comments` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_forecastId_fkey";

-- DropForeignKey
ALTER TABLE "forecast_options" DROP CONSTRAINT "forecast_options_forecastId_fkey";

-- DropForeignKey
ALTER TABLE "forecasts" DROP CONSTRAINT "forecasts_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "votes" DROP CONSTRAINT "votes_forecastId_fkey";

-- DropForeignKey
ALTER TABLE "votes" DROP CONSTRAINT "votes_optionId_fkey";

-- DropForeignKey
ALTER TABLE "votes" DROP CONSTRAINT "votes_userId_fkey";

-- DropIndex
DROP INDEX "comments_forecastId_createdAt_idx";

-- DropIndex
DROP INDEX "comments_forecastId_idx";

-- AlterTable
ALTER TABLE "comments" DROP COLUMN "forecastId",
ALTER COLUMN "predictionId" SET NOT NULL;

-- DropTable
DROP TABLE "forecast_options";

-- DropTable
DROP TABLE "forecasts";

-- DropTable
DROP TABLE "votes";

-- DropEnum
DROP TYPE "ForecastStatus";

-- DropEnum
DROP TYPE "ForecastType";
