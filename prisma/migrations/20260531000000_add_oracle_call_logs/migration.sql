CREATE TABLE "oracle_call_logs" (
    "id"            TEXT NOT NULL,
    "provider"      TEXT NOT NULL,
    "providerChain" TEXT[],
    "query"         TEXT NOT NULL,
    "resultCount"   INTEGER NOT NULL,
    "durationMs"    INTEGER NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oracle_call_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "oracle_call_logs_createdAt_idx" ON "oracle_call_logs"("createdAt");
CREATE INDEX "oracle_call_logs_provider_idx"   ON "oracle_call_logs"("provider");
