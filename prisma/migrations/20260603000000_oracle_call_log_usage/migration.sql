-- Expand oracle_call_logs into a full per-call usage log:
-- every call type + source + status, with engine, http status and user attribution.

-- CreateEnum
CREATE TYPE "OracleCallType" AS ENUM ('SEARCH', 'FORECAST', 'LEADERBOARD', 'HEALTH', 'SEARCH_HEALTH', 'LLM', 'FETCH_URL');
CREATE TYPE "OracleCallStatus" AS ENUM ('OK', 'EMPTY', 'ERROR');

-- AlterTable: new columns (defaults backfill existing rows as legacy successful search calls)
ALTER TABLE "oracle_call_logs"
  ADD COLUMN "callType"     "OracleCallType"   NOT NULL DEFAULT 'SEARCH',
  ADD COLUMN "source"       TEXT               NOT NULL DEFAULT 'legacy',
  ADD COLUMN "status"       "OracleCallStatus" NOT NULL DEFAULT 'OK',
  ADD COLUMN "searchEngine" TEXT,
  ADD COLUMN "httpStatus"   INTEGER,
  ADD COLUMN "userId"       TEXT;

-- Backfill: existing rows are search calls, so their engine is the recorded provider.
UPDATE "oracle_call_logs" SET "searchEngine" = "provider";

-- Relax search-specific columns to nullable (non-search calls won't populate them).
ALTER TABLE "oracle_call_logs" ALTER COLUMN "provider"    DROP NOT NULL;
ALTER TABLE "oracle_call_logs" ALTER COLUMN "query"       DROP NOT NULL;
ALTER TABLE "oracle_call_logs" ALTER COLUMN "resultCount" DROP NOT NULL;

-- ForeignKey (best-effort attribution; keep logs if the user is deleted)
ALTER TABLE "oracle_call_logs"
  ADD CONSTRAINT "oracle_call_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "oracle_call_logs_callType_idx" ON "oracle_call_logs"("callType");
CREATE INDEX "oracle_call_logs_source_idx"   ON "oracle_call_logs"("source");
CREATE INDEX "oracle_call_logs_status_idx"   ON "oracle_call_logs"("status");
CREATE INDEX "oracle_call_logs_userId_idx"   ON "oracle_call_logs"("userId");
