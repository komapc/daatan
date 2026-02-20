-- Add extended bot configuration parameters (Stage 1: DB only, runner wired in Stage 2)
ALTER TABLE "bot_configs"
  ADD COLUMN "activeHoursStart"    INTEGER,
  ADD COLUMN "activeHoursEnd"      INTEGER,
  ADD COLUMN "tagFilter"           JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "voteBias"            INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "cuRefillAt"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cuRefillAmount"      INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "canCreateForecasts"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "canVote"             BOOLEAN NOT NULL DEFAULT true;
