-- CreateEnum
CREATE TYPE "ForecastAttemptOutcome" AS ENUM ('SUCCESS', 'NO_ARTICLES', 'MODERATED', 'SEARCH_UNAVAILABLE', 'GENERATION_FAILED');

-- CreateTable
CREATE TABLE "forecast_creation_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userInput" TEXT NOT NULL,
    "isUrl" BOOLEAN NOT NULL DEFAULT false,
    "outcome" "ForecastAttemptOutcome" NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecast_creation_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forecast_creation_attempts_userId_idx" ON "forecast_creation_attempts"("userId");

-- CreateIndex
CREATE INDEX "forecast_creation_attempts_outcome_idx" ON "forecast_creation_attempts"("outcome");

-- CreateIndex
CREATE INDEX "forecast_creation_attempts_createdAt_idx" ON "forecast_creation_attempts"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "forecast_creation_attempts" ADD CONSTRAINT "forecast_creation_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
