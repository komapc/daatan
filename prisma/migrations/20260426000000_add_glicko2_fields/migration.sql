-- Add Glicko-2 expertise rating fields to users table
ALTER TABLE "users" ADD COLUMN "mu"                 DOUBLE PRECISION NOT NULL DEFAULT 1500;
ALTER TABLE "users" ADD COLUMN "sigma"              DOUBLE PRECISION NOT NULL DEFAULT 350;
ALTER TABLE "users" ADD COLUMN "volatility"         DOUBLE PRECISION NOT NULL DEFAULT 0.06;
ALTER TABLE "users" ADD COLUMN "totalPredictions"   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "correctPredictions" INTEGER NOT NULL DEFAULT 0;
