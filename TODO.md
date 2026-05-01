# TODO.md — Task Queue

*Last updated: May 1, 2026 · v1.10.66*

---

## Open Tasks

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. (Add an implementation plan under `docs/` when you start.)

### Scoring Systems
- [ ] **Polymarket integration (Phase 2)** — add `polymarketPrice Float?` to `Commitment` + `Prediction`; compute KL-divergence vs market at resolution. See `docs/EXPERTISE_RATING_SYSTEM.md` Phase 2.

### Features & UX
- [x] **Web search indexing audit** — hreflang conditional on translation existence, locale pages noindex when untranslated, eo removed from root hreflang, feed pages SSR'd, redundant translate fetch eliminated, Telegram alert on translation failure. (v1.10.67, PR #713)
- [ ] **Progress feedback on long actions** — context analysis now shows step labels ("Searching articles…" / "Analyzing context…" / "Estimating probability…") timed by localStorage-calibrated estimates (defaults: search=10s, llm=12s, oracle=8s); real durations logged as `context.timings` and returned in API response for self-calibration. Remaining: forecast creation, bot runs, resolution processing.
- [ ] **Population-level timing calibration** — aggregate `context.timings` log entries (CloudWatch Insights or a small DB table) to compute server-side medians; return them from a `/api/meta/timings` endpoint so the UI can seed localStorage on first run instead of relying on hardcoded defaults.
- [ ] **Extend step progress to other long actions** — forecast creation (embedding + translation ~5-15s), resolution processing, bot runs.
- [ ] **Microservice for predictions** — defer until a concrete driver appears (independent scaling, separate deploy cadence, or team ownership split). Until then the operational cost (two deployables, auth, data sync, and failure modes) usually outweighs the benefit for a single-app codebase.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
