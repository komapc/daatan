-- AlterTable
ALTER TABLE "bot_configs" ADD COLUMN "fallbackToLLMOnNoTopics" BOOLEAN NOT NULL DEFAULT false;
