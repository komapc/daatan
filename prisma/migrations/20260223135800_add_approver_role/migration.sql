-- AlterEnum
ALTER TYPE "PredictionStatus" ADD VALUE 'PENDING_APPROVAL';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'APPROVER';

-- AlterTable
ALTER TABLE "bot_configs" ADD COLUMN "autoApprove" BOOLEAN NOT NULL DEFAULT false;
