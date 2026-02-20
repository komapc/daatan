-- AddColumn: isBot on users
ALTER TABLE "users" ADD COLUMN "isBot" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn: source on predictions (tracks bot-created content)
ALTER TABLE "predictions" ADD COLUMN "source" VARCHAR(50);

-- CreateEnum: BotAction
CREATE TYPE "BotAction" AS ENUM ('CREATED_FORECAST', 'VOTED', 'SKIPPED', 'ERROR');

-- CreateTable: bot_configs
CREATE TABLE "bot_configs" (
  "id"                  TEXT NOT NULL,
  "userId"              TEXT NOT NULL,
  "personaPrompt"       TEXT NOT NULL,
  "forecastPrompt"      TEXT NOT NULL,
  "votePrompt"          TEXT NOT NULL,
  "newsSources"         JSONB NOT NULL DEFAULT '[]',
  "intervalMinutes"     INTEGER NOT NULL DEFAULT 360,
  "maxForecastsPerDay"  INTEGER NOT NULL DEFAULT 3,
  "maxVotesPerDay"      INTEGER NOT NULL DEFAULT 10,
  "stakeMin"            INTEGER NOT NULL DEFAULT 10,
  "stakeMax"            INTEGER NOT NULL DEFAULT 100,
  "modelPreference"     TEXT NOT NULL DEFAULT 'google/gemini-2.0-flash-exp:free',
  "hotnessMinSources"   INTEGER NOT NULL DEFAULT 2,
  "hotnessWindowHours"  INTEGER NOT NULL DEFAULT 6,
  "isActive"            BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt"           TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bot_configs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "bot_configs"
  ADD CONSTRAINT "bot_configs_userId_key" UNIQUE ("userId");

ALTER TABLE "bot_configs"
  ADD CONSTRAINT "bot_configs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: bot_run_logs
CREATE TABLE "bot_run_logs" (
  "id"            TEXT NOT NULL,
  "botId"         TEXT NOT NULL,
  "runAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "action"        "BotAction" NOT NULL,
  "triggerNews"   JSONB,
  "generatedText" TEXT,
  "forecastId"    TEXT,
  "isDryRun"      BOOLEAN NOT NULL DEFAULT false,
  "error"         TEXT,
  CONSTRAINT "bot_run_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "bot_run_logs"
  ADD CONSTRAINT "bot_run_logs_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "bot_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "bot_run_logs_botId_idx" ON "bot_run_logs"("botId");
CREATE INDEX "bot_run_logs_runAt_idx" ON "bot_run_logs"("runAt");
