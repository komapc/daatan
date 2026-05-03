-- Leaderboard sort columns on User were unindexed, forcing a full table scan
-- for every ORDER BY rs/eloRating/mu/correctPredictions DESC LIMIT N. Cheap
-- now, painful as the user table grows. CREATE INDEX CONCURRENTLY would be
-- preferable but Prisma migrate can't run inside a transaction with it.

CREATE INDEX IF NOT EXISTS "users_rs_idx" ON "users" ("rs" DESC);
CREATE INDEX IF NOT EXISTS "users_elo_rating_idx" ON "users" ("elo_rating" DESC);
CREATE INDEX IF NOT EXISTS "users_mu_idx" ON "users" ("mu" DESC);
CREATE INDEX IF NOT EXISTS "users_correctPredictions_idx" ON "users" ("correctPredictions" DESC);
CREATE INDEX IF NOT EXISTS "users_isBot_idx" ON "users" ("isBot");
