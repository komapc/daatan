-- DropColumns
-- Remove deprecated User fields (isAdmin, isModerator, brierScore)
-- These have been replaced by the `role` enum field.
-- Vote.brierScore is intentionally kept (legacy scoring system).

ALTER TABLE "users" DROP COLUMN "isAdmin";
ALTER TABLE "users" DROP COLUMN "isModerator";
ALTER TABLE "users" DROP COLUMN "brierScore";
