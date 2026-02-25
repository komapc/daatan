-- CreateTable
CREATE TABLE "context_snapshots" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "context_snapshots_predictionId_createdAt_idx" ON "context_snapshots"("predictionId", "createdAt");

-- AddForeignKey
ALTER TABLE "context_snapshots" ADD CONSTRAINT "context_snapshots_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: migrate existing detailsText into context_snapshots for predictions that have contextUpdatedAt
INSERT INTO "context_snapshots" ("id", "predictionId", "summary", "sources", "createdAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "detailsText",
    '[]'::jsonb,
    "contextUpdatedAt"
FROM "predictions"
WHERE "detailsText" IS NOT NULL AND "contextUpdatedAt" IS NOT NULL;
