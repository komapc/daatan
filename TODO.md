# TODO.md — Task Queue

*Last updated: May 1, 2026 · v1.10.69*

---

## Open Tasks

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. (Add an implementation plan under `docs/` when you start.)
- [ ] **Upsize prod EC2 from t3.small to t3.medium** — 2 GB RAM is too thin for app + postgres + nginx + certbot on the same box. Today's incident (2026-05-05): a `docker compose up --force-recreate app` spiked CPU to 70–92%, exhausted memory, killed the SSM agent for ~20 min, and brought daatan.com down for 22 min. t3.medium gives 4 GB at ~+\$15/mo. Right answer at scale is moving postgres to RDS, but t3.medium is the immediate safety buy. Terraform `instance_type` change in `terraform/modules/.../ec2.tf`, single rolling reboot.
- [ ] **Discourage ad-hoc `docker compose up --force-recreate` on prod** — add a one-line warning in `docs/DEPLOYMENT.md` directing operators to `scripts/blue-green-deploy.sh` (or `docker compose restart app` for a no-rebuild restart). The 2026-05-05 incident was caused by bypassing blue-green and force-recreating directly.

### Scoring Systems
- [ ] **Polymarket integration (Phase 2)** — add `polymarketPrice Float?` to `Commitment` + `Prediction`; compute KL-divergence vs market at resolution. See `docs/EXPERTISE_RATING_SYSTEM.md` Phase 2.

### Features & UX
- [x] **Web search indexing audit** — hreflang conditional on translation existence, locale pages noindex when untranslated, eo removed from root hreflang, feed pages SSR'd, redundant translate fetch eliminated, Telegram alert on translation failure. (v1.10.67, PR #713)
- [ ] **Progress feedback on long actions** — context analysis now shows step labels ("Searching articles…" / "Analyzing context…" / "Estimating probability…") timed by localStorage-calibrated estimates (defaults: search=10s, llm=12s, oracle=8s); real durations logged as `context.timings` and returned in API response for self-calibration. Remaining: forecast creation, bot runs, resolution processing.
- [x] **Population-level timing calibration** — `ContextTiming` DB table accumulates per-call samples (non-blocking write in context route); `/api/meta/timings` returns 30-day averages (min 3 samples); `ContextTimeline` seeds localStorage on first run or after 7-day TTL. (v1.10.69, PR #715)
- [ ] **Extend step progress to other long actions** — forecast creation (embedding + translation ~5-15s), resolution processing, bot runs.
- [ ] **Microservice for predictions** — defer until a concrete driver appears (independent scaling, separate deploy cadence, or team ownership split). Until then the operational cost (two deployables, auth, data sync, and failure modes) usually outweighs the benefit for a single-app codebase.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
