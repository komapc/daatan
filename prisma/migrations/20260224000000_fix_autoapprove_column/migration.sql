-- Idempotent fix: add autoApprove column if it doesn't already exist.
-- The original migration (20260223135800_add_approver_role) was recorded as applied
-- in _prisma_migrations on staging but the ALTER TABLE never executed, leaving the
-- column missing. This migration uses IF NOT EXISTS so it is safe to run regardless.
ALTER TABLE "bot_configs" ADD COLUMN IF NOT EXISTS "autoApprove" BOOLEAN NOT NULL DEFAULT false;
