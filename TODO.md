# TODO.md — Task Queue

*Last updated: April 19, 2026 · v1.10.4*

---

## Open Tasks

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. (Add an implementation plan under `docs/` when you start.)
- [x] **GitHub Actions: Migrate to Node.js 24** — `node-version` in `deploy.yml` and `deploy-next.yml` bumped to `'24'`; action majors already current (checkout@v4, setup-node@v4, aws-actions/*@v4/v2, docker/*@v5/v3). Dockerfile was already on node:24-bookworm-slim. CI/CD verified on next Build & Test run.
- [x] **Auto-prune old Docker images on deploy** — `scripts/cleanup-docker-images.sh` wired into staging + prod deploys; keeps 3 newest app + 3 newest migrations tags. Fixes the 99%-disk outage on 2026-04-18.

### Features & UX
- [x] **Speedometer wrong value** — fixed: community gauge uses CU-weighted yes/no totals (see `ForecastDetailClient.speedometer.test.tsx` and `/api/forecasts` enrichment).
- [ ] **Search** — add a search endpoint + UI so users can find forecasts by claim text / tag / author. No search today beyond filter pills on the feed.
- [ ] **Find similar forecasts** — on a forecast detail page, surface a "Similar forecasts" section. Candidates: tag overlap, claim-text similarity (embedding-based), shared news anchor. Needed as duplication check when creating new forecasts too.
- [ ] **Fix leaderboard** — known broken / incorrect ranking. Audit RS / accuracy calculation, Brier-score path, and the ranking API before fixing (no concrete repro yet — user reported general brokenness).
- [ ] **Microservice for predictions** — defer until a concrete driver appears (independent scaling, separate deploy cadence, or team ownership split). Until then the operational cost (two deployables, auth, data sync, and failure modes) usually outweighs the benefit for a single-app codebase.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
