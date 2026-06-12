-- CreateTable: per-user per-tag ELO and Glicko-2 ratings.
-- Populated lazily on first leaderboard request for a tag; updated
-- incrementally at resolution time (same transaction as global ratings).

CREATE TABLE "user_tag_ratings" (
  "id"         TEXT             NOT NULL,
  "userId"     TEXT             NOT NULL,
  "tagId"      TEXT             NOT NULL,
  "elo"        DOUBLE PRECISION NOT NULL DEFAULT 1500,
  "mu"         DOUBLE PRECISION NOT NULL DEFAULT 1500,
  "sigma"      DOUBLE PRECISION NOT NULL DEFAULT 350,
  "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  "updatedAt"  TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "user_tag_ratings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_tag_ratings"
  ADD CONSTRAINT "user_tag_ratings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_tag_ratings"
  ADD CONSTRAINT "user_tag_ratings_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "user_tag_ratings_userId_tagId_key" ON "user_tag_ratings"("userId", "tagId");
CREATE INDEX "user_tag_ratings_tagId_idx" ON "user_tag_ratings"("tagId");
