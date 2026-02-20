-- AddColumn: winnersPoolBonus on predictions
ALTER TABLE "predictions" ADD COLUMN "winners_pool_bonus" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: commitment_withdrawals
CREATE TABLE "commitment_withdrawals" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "predictionId" TEXT NOT NULL,
  "cuCommitted"  INTEGER NOT NULL,
  "cuBurned"     INTEGER NOT NULL,
  "cuRefunded"   INTEGER NOT NULL,
  "burnRate"     INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commitment_withdrawals_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "commitment_withdrawals"
  ADD CONSTRAINT "commitment_withdrawals_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commitment_withdrawals"
  ADD CONSTRAINT "commitment_withdrawals_predictionId_fkey"
  FOREIGN KEY ("predictionId") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "commitment_withdrawals_userId_idx" ON "commitment_withdrawals"("userId");
CREATE INDEX "commitment_withdrawals_predictionId_idx" ON "commitment_withdrawals"("predictionId");

-- AddValue: new CuTransactionType enum values
ALTER TYPE "CuTransactionType" ADD VALUE 'WITHDRAWAL_PENALTY';
ALTER TYPE "CuTransactionType" ADD VALUE 'WITHDRAWAL_REFUND';
ALTER TYPE "CuTransactionType" ADD VALUE 'VOID_BURN_REFUND';
