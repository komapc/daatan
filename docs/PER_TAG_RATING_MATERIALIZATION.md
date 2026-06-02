# Per-tag rating materialization — design proposal

Status: **proposed** (not implemented). Tracking issue: _(link from the PR)_.

## Problem

The leaderboard computes ELO and Glicko-2 ratings two ways:

- **Global (no tag):** read the stored `User.eloRating` / `User.mu` / `User.sigma`
  columns, which are updated incrementally at resolution time.
- **Per-tag:** `replayEloHistory(tagSlug)` and `replayGlicko2History(tagSlug)`
  re-derive ratings **from scratch** by replaying every resolved commitment for
  that tag in chronological order, on **every leaderboard request**.

(The no-tag path used to replay too; that redundant work was removed — see the
"skip no-tag ELO replay" change. This proposal is about the remaining per-tag
replay.)

Per-tag replay is `O(resolved commitments in the tag)` per request, with no
caching. It's fine at current volume but is the clearest scaling cliff: as
resolved-commitment counts grow, every tag-filtered leaderboard view (and any
per-tag rating shown elsewhere) pays the full replay cost.

## Goals

- Serve per-tag ELO/Glicko ratings without a full-history replay per request.
- Keep ratings correct and consistent with the global incremental values.
- Stay compatible with the blue-green migration flow (migrations run via the
  dedicated migrations container in Phase 5).

## Non-goals

- Changing the rating math (ELO / Glicko-2 formulas, the `mu - 3σ` rank, the
  per-tag "min 3 resolved" gates). This is purely about *where/when* the numbers
  are computed.

## Options considered

### A. Materialized per-(user, tag) rating table  ✅ recommended

A new table holds the current rating per user per tag, updated at resolution
time the same way the global `User.eloRating` columns already are.

```prisma
model UserTagRating {
  id          String   @id @default(cuid())
  userId      String
  tagId       String
  eloRating   Float    @default(1500)
  mu          Float    @default(1500)
  sigma       Float    @default(350)
  volatility  Float    @default(0.06)
  resolvedCount Int    @default(0)   // for the "min 3" gates
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([userId, tagId])
  @@index([tagId])
}
```

- **Read path:** the leaderboard reads `UserTagRating` for the selected tag —
  no replay.
- **Write path:** in `prediction-resolution.ts`, after the existing global ELO
  pairwise + Glicko update, also update the per-tag rows for each tag on the
  resolved prediction (pairwise ELO is scoped to the tag's participants;
  Glicko per (user, tag)).
- **Backfill:** a one-off migration/script runs `replayEloHistory(tag)` +
  `replayGlicko2History(tag)` for every existing tag and writes the results.
  This is the same code already used for the live replay, so no new math.
- **Recompute/repair:** keep `replayEloHistory(tag)` as the source of truth for
  an admin "recalculate" action (mirrors the existing global
  `/api/admin/recalculate-elo`), which overwrites the table.

Trade-offs: schema change + a backfill migration + extra writes at resolution
(bounded by tags-per-prediction, typically ≤5). Highest payoff; matches the
existing global-rating pattern.

### B. In-process TTL cache of replayed per-tag ratings

Cache the `Map` returned by `replayEloHistory(tag)` / `replayGlicko2History(tag)`
keyed by tag, with a short TTL and invalidation when a prediction in that tag
resolves.

- No schema change, smaller blast radius.
- But: cold-cache requests still pay the full replay; correctness depends on
  invalidation wiring; in a multi-instance (blue-green) deployment the cache is
  per-process, so hit rates and invalidation are weaker. Lower, less durable
  payoff.

### C. Do nothing (status quo)

Acceptable until per-tag resolved-commitment counts make replay latency or DB
load noticeable. Revisit when leaderboard p95 latency or DB CPU on tag-filtered
requests crosses a threshold.

## Recommendation

Implement **A** when volume warrants it. It removes the per-request replay
entirely, reuses the existing replay code for backfill + admin repair, and
follows the pattern already established by the global stored ratings.

## Open questions (resolve before implementation)

1. **Recompute trigger:** update per-tag rows synchronously inside the
   resolution transaction, or asynchronously (job/queue) after it? Synchronous
   is simplest and consistent; async avoids lengthening the resolution txn.
2. **Backfill execution:** one-shot migration step vs. an admin-triggered script
   vs. the migrations container. Must handle the case where new tags appear
   after backfill (lazy-init a row at 1500/350 on first read).
3. **Pairwise ELO scoping per tag:** confirm the per-tag pairwise comparison set
   matches what `replayEloHistory(tag)` currently produces, so materialized
   values equal the replay exactly.
4. **`min 3 resolved` gates:** `resolvedCount` must be tracked per (user, tag)
   so `roi` / `truthScore` / `weightedPeerScore` thresholds behave identically.
5. **Invalidation on un-resolve / re-resolve / vote edits:** any path that
   mutates historical commitments must trigger a per-tag recompute for the
   affected tag(s).

## References

- `src/lib/services/leaderboard.ts` — `getLeaderboard`, the per-tag branch
- `src/lib/services/elo.ts` — `replayEloHistory(tagSlug?)`
- `src/lib/services/expertise.ts` — `replayGlicko2History(tagSlug?)`
- `src/lib/services/prediction-resolution.ts` — where global ratings update today
- `docs/SCORING_SYSTEMS.md`, `docs/EXPERTISE_RATING_SYSTEM.md`
