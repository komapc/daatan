-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'RESOLVER', 'ADMIN');

-- AlterTable
ALTER TABLE "forecasts" ALTER COLUMN "slug" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "predictions" ALTER COLUMN "slug" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
ALTER COLUMN "slug" SET DATA TYPE TEXT;



-- Data Migration
UPDATE "users" SET "role" = 'ADMIN' WHERE "isAdmin" = true;
UPDATE "users" SET "role" = 'RESOLVER' WHERE "isModerator" = true AND "isAdmin" = false;
