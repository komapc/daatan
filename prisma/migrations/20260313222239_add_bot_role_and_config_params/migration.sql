-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'BOT';

-- DropForeignKey
ALTER TABLE "bot_rejected_topics" DROP CONSTRAINT "bot_rejected_topics_botId_fkey";

-- DropForeignKey
ALTER TABLE "bot_rejected_topics" DROP CONSTRAINT "bot_rejected_topics_rejectedById_fkey";

-- AlterTable
ALTER TABLE "predictions" ALTER COLUMN "extractedEntities" SET DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "bot_rejected_topics" ADD CONSTRAINT "bot_rejected_topics_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_rejected_topics" ADD CONSTRAINT "bot_rejected_topics_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
