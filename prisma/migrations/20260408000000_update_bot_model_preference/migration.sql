-- Update deprecated OpenRouter model slug for all existing bots
UPDATE "BotConfig"
SET "modelPreference" = 'google/gemini-2.5-flash-preview:free'
WHERE "modelPreference" = 'google/gemini-2.0-flash-exp:free';

-- Update default value for new bots
ALTER TABLE "BotConfig"
ALTER COLUMN "modelPreference" SET DEFAULT 'google/gemini-2.5-flash-preview:free';
