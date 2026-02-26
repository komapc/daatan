-- Add probability and brierScore fields to commitments for Brier score tracking
ALTER TABLE "commitments" ADD COLUMN "probability" DOUBLE PRECISION;
ALTER TABLE "commitments" ADD COLUMN "brierScore" DOUBLE PRECISION;
