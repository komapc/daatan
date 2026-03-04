-- DropIndex
DROP INDEX "news_anchors_urlHash_idx";

-- AlterTable
ALTER TABLE "bot_configs" ALTER COLUMN "newsSources" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT;
