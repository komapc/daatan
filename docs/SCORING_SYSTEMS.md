# Scoring Systems — Architecture & Reference

## Overview

DAATAN supports multiple scoring systems for ranking predictors on the leaderboard. Each system measures a different aspect of forecasting skill. Systems are tag-filterable — the leaderboard can rank users within a specific topic using the `?tag=` parameter.

The scoring architecture is defined in `src/lib/services/scoring-systems.ts`. Adding a new scoring system requires only:
1. Adding its key to `SortBy`
2. Adding its aggregated data field to `ScoringContext` (plus one DB query in `leaderboard.ts`)
3. Adding a `ScoringSystem` descriptor to `SCORING_SYSTEMS`

No changes to the sort loop or leaderboard entry construction are required.

---

## Scoring Systems

### Reputation Score (RS)

**Key:** `rs` · **Sort:** higher is better

The original DAATAN score. Earned by making correct forecasts weighted by confidence (CU committed). Wrong calls reduce RS proportionally. Global field on `User.rs` — not tag-filterable.

**Formula:** RS change = f(confidence, outcome, pool) — computed at resolution.

---

### Accuracy

**Key:** `accuracy` · **Sort:** higher is better

Percentage of resolved commitments where `rsChange > 0` (i.e. the commitment was "correct" enough to gain RS). Tag-filtered.

**Formula:** `correct_count / resolved_count × 100`

---

### Most Correct

**Key:** `totalCorrect` · **Sort:** higher is better

Raw count of correct resolved commitments in the selected tag scope.

---

### CU Committed

**Key:** `cuCommitted` · **Sort:** higher is better

Total Confidence Units staked in the selected tag scope. Measures conviction and participation volume.

---

### Brier Score

**Key:** `brierScore` · **Sort:** lower is better

Calibration measure: `(predicted_probability − actual_outcome)²`. Perfect score = 0. Tag-filtered average across all resolved commitments.

Ranges:
- Binary: `p = (confidence + 100) / 200`, outcome ∈ {0, 1}
- Multiple-choice: `p = confidence / 100`

---

### ELO Rating

**Key:** `elo` · **Sort:** higher is better · **Per-tag:** yes (replayed)

Head-to-head competitive rating. When two users commit to the same prediction, the more accurate one (lower Brier score) gains ELO from the other.

**Global:** stored incrementally on `User.eloRating`, updated at each resolution.  
**Per-tag:** replayed from scratch (all start at 1500) using only commitments tagged with the selected tag. Computed by `replayEloHistory(tagSlug)` in `src/lib/services/elo.ts`.

**Update formula:** K=32 pairwise:
```
expected_A = 1 / (1 + 10^((elo_B - elo_A) / 400))
delta_A = K × (actual_A - expected_A)
actual_A = brierScore_A < brierScore_B ? 1 : brierScore_A > brierScore_B ? 0 : 0.5
```

---

### Glicko-2 Rating

**Key:** `glicko` · **Sort:** higher is better · **Per-tag:** yes (replayed)

Uncertainty-aware skill rating. The leaderboard rank uses `μ − 3σ` (lower bound of skill), which prevents one-hit wonders from topping the board — a user with one correct prediction has high σ and thus a low floor.

**Global:** stored incrementally on `User.mu`, `User.sigma`, `User.volatility`, updated at each resolution.  
**Per-tag:** replayed from scratch (all start at defaults: μ=1500, σ=350, volatility=0.06) using only tag-filtered commitments, in resolvedAt order. Computed by `replayGlicko2History(tagSlug)` in `src/lib/services/expertise.ts`.

**Rank formula:** `μ − 3σ`  
**Outcome signal:** `score = 1 − brierScore` (0=worst, 1=perfect)  
**Reference opponent:** social consensus baseline at μ=1500, σ=350  
**Constants:** SCALE=173.7178, TAU=0.5, ε=1e-6  
**Minimum (per-tag only):** requires ≥3 resolved predictions in the selected tag; users below this threshold return `null` and sort last — same as `roi` and `truthScore`.

Reference: [Glickman (2012)](http://www.glicko.net/glicko/glicko2.pdf)

---

### Peer Score

**Key:** `peerScore` · **Sort:** higher is better · **Tag-filtered:** yes

Measures how much better your probability estimates are compared to the community consensus at commit time.

**Formula per commitment:** `(community_probability − outcome)² − (user_probability − outcome)²`  
Positive = you beat the crowd; negative = the crowd was more accurate than you.  
Stored on `Commitment.peerScore` at resolution.

**Leaderboard value:** sum of all peer scores in the selected tag scope.

---

### AI Score

**Key:** `aiScore` · **Sort:** higher is better · **Tag-filtered:** yes

Measures how much better your probability estimates are compared to the AI's estimate at commit time.

**Formula per commitment:** `(ai_probability − outcome)² − (user_probability − outcome)²`  
Positive = you beat the AI.  
Stored on `Commitment.aiScore` at resolution.

**Leaderboard value:** sum of all AI scores in the selected tag scope.

---

### TruthScore

**Key:** `truthScore` · **Sort:** higher is better · **Tag-filtered:** yes

Average peer score per prediction — how *consistently* you beat community consensus, normalised for prediction volume. Requires minimum 3 resolved predictions to avoid noise.

**Formula:** `peer_score_sum / peer_score_count` (min 3 predictions)  
Range: typically −0.25 to +0.25

---

### ROI

**Key:** `roi` · **Sort:** higher is better · **Tag-filtered:** yes

Average net RS change per resolved prediction. Positive = you earn RS on average; negative = you lose RS. Requires minimum 3 resolved predictions.

**Formula:** `sum(rsChange) / count(rsChange)` (min 3 predictions, all signs included)

---

### Weighted Peer Score *(Metaculus-style)*

**Key:** `weightedPeerScore` · **Sort:** higher is better · **Tag-filtered:** yes

Peer score with exponential time decay — recent predictions count more than older ones. Inspired by [Metaculus](https://www.metaculus.com) scoring.

**Formula:**
```
weightedPeerScore = Σ(peerScore_i × decay^(days_since_resolution / 30))
                   / Σ(decay^(days_since_resolution / 30))
```
Where `decay = 0.95` (approximately half-weight after ~14 months).

Requires minimum 3 resolved predictions. Computed at query time from `Commitment.peerScore` and `Prediction.resolvedAt`.

---

## Adding a New Scoring System

1. **Add the key** to `SortBy` in `src/lib/services/scoring-systems.ts`

2. **If a DB query is needed**, add a field to `ScoringContext` and run the query in the `Promise.all` block of `getLeaderboard` in `src/lib/services/leaderboard.ts`

3. **Add a descriptor** to `SCORING_SYSTEMS`:
   ```typescript
   {
     key: 'mySystem',
     lowerIsBetter: false,  // optional, default: higher is better
     compute: (userId, user, ctx) => {
       // return number | null
       return ctx.mySystemByUser.get(userId) ?? null
     },
   }
   ```

4. **Update the API route**: `SortBy` is re-exported from `leaderboard.ts`, so no change needed if it's already in `scoring-systems.ts`.

5. **Update the UI** in `src/app/leaderboard/page.tsx`: add to `SORT_OPTIONS`, `getHighlightValue`, `getHighlightLabel`, `getHighlightColor`, and `LeaderboardUser` type.

6. **Add i18n keys** for `sortBy.mySystem` and `legend.mySystemTitle/Desc` in all 4 language files (`en.json`, `ru.json`, `he.json`, `eo.json`).

---

## Per-Tag Scoring

When a tag is selected via `?tag=slug`:

| System | Per-tag behaviour |
|--------|------------------|
| RS | Global (stored per user, not tag-filterable) |
| ELO | Replayed from scratch using only tag-filtered commitments |
| Glicko-2 | Replayed from scratch using only tag-filtered commitments |
| Brier Score | Filtered: only commitments on tagged predictions |
| Peer Score | Filtered |
| AI Score | Filtered |
| TruthScore | Filtered |
| ROI | Filtered |
| Weighted Peer Score | Filtered |
| Accuracy | Filtered |
| CU Committed | Filtered |
| Most Correct | Filtered |

ELO and Glicko-2 per-tag replays start all users at default ratings, so the tag leaderboard represents "if this topic were all you ever predicted, how skilled would you be?"

**Note:** Per-tag Glicko-2 requires ≥3 resolved predictions in the tag before a score is surfaced; users with fewer appear at the bottom (same as ROI and TruthScore). ELO has no minimum threshold.

---

## Implementation Files

| File | Role |
|------|------|
| `src/lib/services/scoring-systems.ts` | `SortBy`, `ScoringContext`, `ScoringSystem` interface, `SCORING_SYSTEMS` registry |
| `src/lib/services/leaderboard.ts` | Builds `ScoringContext`, runs aggregations, applies registry sort |
| `src/lib/services/elo.ts` | `calculateEloUpdates`, `replayEloHistory(tagSlug?)` |
| `src/lib/services/expertise.ts` | `glicko2Update`, `applyGlicko2Update`, `replayGlicko2History(tagSlug?)` |
| `src/app/leaderboard/page.tsx` | Client UI, sort tabs, tag filter, display columns |
| `src/app/api/leaderboard/route.ts` | `GET /api/leaderboard?sortBy=&tag=&limit=` |
