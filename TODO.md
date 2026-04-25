# TODO.md — Task Queue

*Last updated: April 25, 2026 · v1.10.33*

---

## Open Tasks

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. (Add an implementation plan under `docs/` when you start.)

### Code Quality & Architecture
- [ ] **Service layer for API routes** — ~86 direct `prisma.*` calls remaining across 43 files in `src/app/api/`. Pass 1 done (forecast + comment routes, PR #663). Pass 2 done (notifications, user/profile, leaderboard, tags, PR #680). Continue extracting business logic into `src/lib/services/`.

### i18n (untranslated components)
~~Admin components — done in PR #679 (v1.10.32)~~

### Features & UX
- [ ] **Microservice for predictions** — defer until a concrete driver appears (independent scaling, separate deploy cadence, or team ownership split). Until then the operational cost (two deployables, auth, data sync, and failure modes) usually outweighs the benefit for a single-app codebase.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
