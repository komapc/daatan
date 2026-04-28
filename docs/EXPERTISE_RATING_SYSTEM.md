# Expertise Rating System — Design Plan

## Overview

The goal is to replace the current simple Reputation Score (`rs`) with a robust expertise rating that rewards **volume**, **calibration**, and **consistency** — not lucky guesses.

Users' predictions are compared against multiple baselines to measure true alpha, not just accuracy.

---

## Benchmarks (The "Who to Beat")

| Baseline | What it measures |
|---|---|
| **Ground Truth** | Final binary/categorical outcome |
| **AI Baseline** | Summary of current public information at commit time |
| **Polymarket Price** | Efficient market consensus — beating this = real alpha |
| **Social Consensus** | Average probability of all other DAATAN users |

---

## Rating Mechanisms

### Phase 1 — Glicko-2 (implement first)

Replaces the flat `rs` float with a proper uncertainty-aware rating vector.

**Fields to add to `User`:**
```sql
mu           Float  @default(1500)   -- current skill estimate
sigma        Float  @default(350)    -- uncertainty (high = few predictions)
volatility   Float  @default(0.06)   -- how erratic the user's skill is
totalPredictions  Int @default(0)
correctPredictions Int @default(0)
```

**Leaderboard formula:** `rank = μ - 3σ`

This mathematically guarantees a one-hit wonder can never outrank a high-volume consistent expert. A user with 1 correct prediction has high σ and thus a low rank floor.

**Update trigger:** Recalculate on every prediction resolution, using the Brier score already stored in `Commitment.brierScore` as the outcome signal.

### Phase 2 — Polymarket Integration (later)

Add `polymarketPrice Float?` to both `Commitment` and `Prediction`. No need for full API integration immediately — start collecting the data and compute KL-divergence and lead-lag metrics later.

**KL-Divergence:** Rewards users who provide surprising correct information. If Polymarket says 10% and you say 90% and win → massive boost.

**Lead-Lag Metric:** Tracks the delta between when a user makes a high-confidence correct call and when AI/Polymarket catches up to the same probability. Users who lead the market are "signals"; those who follow are "noise".

---

## Calibration: Brier Score (already implemented)

`brierScore = (probability - outcome)²` — already stored per commitment.

This penalises confidently-wrong predictions exponentially and forces honest use of the confidence slider.

---

## Time-Weighted Difficulty

Predictions made when outcome entropy is high (far from resolution, outcome uncertain) earn a higher multiplier. This rewards early, correct, high-confidence calls.

Implementation: store `entropyAtCommit` (derived from Polymarket price or social consensus spread) on `Commitment`.

---

## Conviction Bonus vs Pivot Penalty

The system version-controls votes rather than overwriting them (already the case — no edit on `Commitment`).

- **Conviction Bonus**: reserved for users who were correct from the start, without changing their vote.
- **Flip-flop detection**: users who shift probability alongside the Polymarket ticker are flagged as "noise".
- **Pivot logic**: changing a vote as new information arrives is allowed, but earns no conviction bonus.

---

## Implementation Roadmap

### Phase 1 — Glicko-2 Core ✅ done in v1.10.35 (PR #681)

- [x] Add `mu`, `sigma`, `volatility`, `totalPredictions`, `correctPredictions` to `User`
- [x] Write Glicko-2 update function in `src/lib/services/expertise.ts`
- [x] Call it from the prediction resolution flow
- [x] Update leaderboard query to sort by `mu - 3 * sigma` (`GET /api/leaderboard?sortBy=glicko`)
- [x] Display `μ ± σ` on user profile

### Phase 2 — Market Baseline (later)

- [ ] Add `polymarketPrice Float?` to `Commitment` and `Prediction`
- [ ] Ingest Polymarket price at commitment time (API or manual)
- [ ] Compute KL-divergence vs market at resolution
- [ ] Compute lead-lag delta

### Phase 3 — Leaderboard & UI ✅ done in v1.10.53

- [x] Leaderboard page sortable by Glicko-2 (`μ − 3σ`) — global and per-tag
- [x] Per-tag Glicko-2 replay via `replayGlicko2History(tagSlug)` in `expertise.ts`
- [x] Multi-system leaderboard: ELO, Brier, Peer Score, AI Score, TruthScore, ROI, Weighted Peer Score
- [x] ScoringSystem registry in `src/lib/services/scoring-systems.ts` — adding new systems requires no core changes
- [ ] User profile: skill history chart over time
- [ ] "Signal vs Noise" indicator per user

See `docs/SCORING_SYSTEMS.md` for the full scoring system reference and architecture guide.

---

## What We Intentionally Deferred

These ideas from the brainstorm are valid but over-engineered for current scale:

- **Full Polymarket integration** — requires reliable price at every commit time; deferred to Phase 2
- **KL-Divergence scoring** — depends on Polymarket data; deferred
- **Lead-lag metric** — requires full Polymarket price history; deferred to Phase 2+
- **Lambda/ECS ingestion pipeline** — current volume doesn't justify the infra; Next.js API routes are sufficient

---

## References

- Glicko-2 paper: Glickman (2012) — http://www.glicko.net/glicko/glicko2.pdf
- Brier score: already in `Commitment.brierScore`
- Polymarket API: https://docs.polymarket.com
