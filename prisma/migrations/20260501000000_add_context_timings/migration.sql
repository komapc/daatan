CREATE TABLE "context_timings" (
    "id" TEXT NOT NULL,
    "searchMs" INTEGER NOT NULL,
    "llmMs" INTEGER NOT NULL,
    "oracleMs" INTEGER NOT NULL,
    "totalMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_timings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "context_timings_createdAt_idx" ON "context_timings"("createdAt");
