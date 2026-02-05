-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
