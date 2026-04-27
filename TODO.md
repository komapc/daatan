# TODO.md — Task Queue

*Last updated: April 27, 2026 · v1.10.42*

---

## Open Tasks

### Code Quality & Type Safety

- [ ] **[QA-1] Auth `as any` / `as unknown` casts** — `src/auth.ts` and `src/auth.config.ts` use ~7 unsafe casts in JWT/session callbacks. Define proper `declare module 'next-auth'` augmentations for `Session` and `JWT` so role assignment is type-checked.
- [ ] **[QA-2] `any` in forecast service** — `src/lib/services/forecast.ts:84-85` (`(pred as any).options`) and line 165 (`outcomeType as any`). Replace with proper typed includes and a typed enum cast.
- [ ] **[QA-3] `schema?: any` in bot runner** — `src/lib/services/bots/runner.ts:74`. Replace with a proper `ZodTypeAny` or `z.ZodType<unknown>` bound so callers can't pass arbitrary values.
- [ ] **[QA-4] `$executeRawUnsafe` in test helper** — `src/test/integration-helper.ts:52` uses string interpolation in a TRUNCATE call. Refactor to a static allow-list of table names to prevent copy-paste into production.

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
