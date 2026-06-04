-- Link an Oracle call to the forecast it relates to (when known).
ALTER TABLE "oracle_call_logs" ADD COLUMN "predictionId" TEXT;

CREATE INDEX "oracle_call_logs_predictionId_idx" ON "oracle_call_logs"("predictionId");

ALTER TABLE "oracle_call_logs"
  ADD CONSTRAINT "oracle_call_logs_predictionId_fkey"
  FOREIGN KEY ("predictionId") REFERENCES "predictions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
