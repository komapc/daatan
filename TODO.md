# TODO.md — Task Queue

*Last updated: April 22, 2026 · v1.10.26*

---

## Open Tasks

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. (Add an implementation plan under `docs/` when you start.)

### Code Quality & Architecture
- [ ] **Service layer for API routes** — ~105 direct `prisma.*` calls remaining across 47 files in `src/app/api/`. Pass 1 done (forecast + comment routes, PR #663). Continue extracting business logic into `src/lib/services/`.
- [ ] **Translate ExpressForecastClient** — the Express forecast creation page (`src/app/forecasts/express/ExpressForecastClient.tsx`) has never used `next-intl`. All UI strings are hardcoded English. Wire up `useTranslations` and add keys to all four locale files (en/ru/eo/he).

### Features & UX
- [ ] **Microservice for predictions** — defer until a concrete driver appears (independent scaling, separate deploy cadence, or team ownership split). Until then the operational cost (two deployables, auth, data sync, and failure modes) usually outweighs the benefit for a single-app codebase.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
