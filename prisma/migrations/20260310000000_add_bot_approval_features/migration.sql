-- Add bot approval workflow features

-- Add approval workflow fields to bot_configs
ALTER TABLE "bot_configs" ADD COLUMN "requireApprovalForForecasts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bot_configs" ADD COLUMN "enableSentimentExtraction" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bot_configs" ADD COLUMN "enableRejectionTracking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bot_configs" ADD COLUMN "showMetadataOnForecast" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bot_configs" ADD COLUMN "maxForecastsPerHour" INTEGER NOT NULL DEFAULT 0;

-- Add bot-generated metadata fields to predictions
ALTER TABLE "predictions" ADD COLUMN "sentiment" VARCHAR(20);
ALTER TABLE "predictions" ADD COLUMN "confidence" INTEGER;
ALTER TABLE "predictions" ADD COLUMN "extractedEntities" TEXT[];
ALTER TABLE "predictions" ADD COLUMN "consensusLine" TEXT;
ALTER TABLE "predictions" ADD COLUMN "sourceSummary" TEXT;

-- Create bot_rejected_topics table
CREATE TABLE "bot_rejected_topics" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "botId" TEXT NOT NULL,
  "keywords" TEXT[],
  "description" VARCHAR(500) NOT NULL,
  "rejectedById" TEXT NOT NULL,
  "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bot_rejected_topics_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot_configs" ("id") ON DELETE CASCADE,
  CONSTRAINT "bot_rejected_topics_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users" ("id") ON DELETE CASCADE
);

-- Create indexes for bot_rejected_topics
CREATE INDEX "bot_rejected_topics_botId_idx" ON "bot_rejected_topics"("botId");
CREATE INDEX "bot_rejected_topics_rejectedAt_idx" ON "bot_rejected_topics"("rejectedAt");
