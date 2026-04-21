# TODO.md — Task Queue

*Last updated: April 21, 2026 · v1.10.23*

---

## Open Tasks

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. (Add an implementation plan under `docs/` when you start.)

### Code Quality & Architecture
- [ ] **Service layer for API routes** — ~105 direct `prisma.*` calls remaining across 47 files in `src/app/api/`. Pass 1 done (forecast + comment routes, PR #663). Continue extracting business logic into `src/lib/services/`.

### Features & UX
- [ ] **Verbose forecast creation progress** — the creation flow (article fetch → AI content analysis → moderation → forecast save) can take 10–20 s with no feedback beyond a generic spinner. Add step-by-step status messages in the creation UI so the user knows what's happening at each stage (e.g. "Fetching article…", "Analysing content…", "Checking moderation…", "Saving forecast…").
- [ ] **Microservice for predictions** — defer until a concrete driver appears (independent scaling, separate deploy cadence, or team ownership split). Until then the operational cost (two deployables, auth, data sync, and failure modes) usually outweighs the benefit for a single-app codebase.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
