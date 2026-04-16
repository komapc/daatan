-- AlterTable: add full Oracle forecast payload to context snapshots
ALTER TABLE "context_snapshots" ADD COLUMN "oracle_snapshot" JSONB;
