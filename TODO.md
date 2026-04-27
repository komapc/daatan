# TODO.md — Task Queue

*Last updated: April 27, 2026 · v1.10.42*

---

## Open Tasks


### Reliability

- [ ] **[REL-1] Retry/circuit-breaker for background tasks** — both the post-creation translation (`api/forecasts/route.ts:177`) and push notification dispatch (`services/notification.ts:90-98`) are fully fire-and-forget with no retry. Add a lightweight retry wrapper (e.g. 3 attempts with exponential backoff) or a job queue entry so failures are recoverable.

---

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. (Add an implementation plan under `docs/` when you start.)

### Code Quality & Architecture
- [ ] **Service layer for API routes** — 13 direct `prisma.*` calls remaining in 6 files (context, research, health, backfill-rules, stats, commit/preview — all LLM-intertwined or trivial). Pass 1 done (forecast + comment routes, PR #663). Pass 2 done (notifications, user/profile, leaderboard, tags, PR #680). Pass 3 done (forecast CRUD, approve/reject/publish, comment CRUD+reactions, bot admin, user admin, push subscriptions, news anchors, auth signup/reset, commitments — v1.10.34).

### Features & UX
- [ ] **Microservice for predictions** — defer until a concrete driver appears (independent scaling, separate deploy cadence, or team ownership split). Until then the operational cost (two deployables, auth, data sync, and failure modes) usually outweighs the benefit for a single-app codebase.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
