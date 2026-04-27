-- Add competitive scoring fields to commitments
ALTER TABLE "commitments"
  ADD COLUMN "community_probability_at_commit" DOUBLE PRECISION,
  ADD COLUMN "ai_probability_at_commit"        DOUBLE PRECISION,
  ADD COLUMN "peer_score"                      DOUBLE PRECISION,
  ADD COLUMN "ai_score"                        DOUBLE PRECISION,
  ADD COLUMN "elo_change"                      INTEGER;

-- Add ELO rating to users
ALTER TABLE "users"
  ADD COLUMN "elo_rating" DOUBLE PRECISION NOT NULL DEFAULT 1500;
