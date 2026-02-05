-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferredLanguage" VARCHAR(10) NOT NULL DEFAULT 'en';
