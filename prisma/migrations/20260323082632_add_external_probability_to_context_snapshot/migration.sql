-- AlterTable
ALTER TABLE "context_snapshots"
  ADD COLUMN "external_probability" INTEGER,
  ADD COLUMN "external_reasoning"   TEXT;
