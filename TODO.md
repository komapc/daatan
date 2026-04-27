# TODO.md — Task Queue

*Last updated: April 27, 2026 · v1.10.35*

---

## Open Tasks

### Security — Immediate (fix before next prod deploy)

- [x] **[SEC-1] Glicko2 outside transaction** — already correct; `applyGlicko2Update` receives `tx` and runs inside `prisma.$transaction()`. Audit finding was stale (checked post-PR #681).
- [x] **[SEC-2] `BOT_RUNNER_SECRET` not validated at startup** — added to `src/env.ts` schema (`z.string().min(1).optional()`); both routes now read from `env.BOT_RUNNER_SECRET` instead of `process.env`.
- [x] **[SEC-3] backfill-rules endpoint open to all authenticated users** — already correct; `withAuth` already carries `roles: ['ADMIN']` on line 73. Audit finding was stale.
- [x] **[SEC-4] Timing-unsafe secret comparison** — replaced `!==` comparison with `crypto.timingSafeEqual()` (SHA-256 hash normalisation to handle length differences) in both `api/bots/run/route.ts` and `api/cron/cleanup/route.ts`.

### Security — Short Term

- [x] **[SEC-5] No rate limiting on LLM-backed endpoints** — added `src/lib/rate-limit.ts` (in-memory sliding window, no external deps). `research`: 10/hour per user; `translate`: 20/hour per IP; `admin/bots/[id]/run`: 5/hour per user. All return `429` with `Retry-After` header on violation.
- [x] **[SEC-6] Unbounded input on public search** — `q` capped at 200 chars, tags capped at 10 items × 50 chars each in `api/forecasts/similar/route.ts`.
- [x] **[SEC-7] Notification IDOR — explicit ownership check** — `markNotificationRead` already enforces ownership via `WHERE { id, userId }`; `count === 0` is the explicit 404 guard. Added a comment to document this invariant so it isn't accidentally removed.

### Testing — Critical gaps

- [x] **[TEST-1] Glicko-2 algorithm has zero tests** — 15 tests in `src/lib/services/__tests__/expertise.test.ts` covering: σ shrinks after first game, rating direction for score=0/1, baseline score≈0.5 near-zero delta, sigma convergence after 20 wins, volatility bounds, expert vs fresh-user gain comparison, NaN/Inf edge cases, and all `applyGlicko2Update` DB call invariants.
- [x] **[TEST-2] Commitment `lockedAt` unverified** — 3 tests in `__tests__/services/commitment-lockedat.test.ts`: sets lockedAt on first commit, does NOT update on subsequent commits, returns 400 for non-ACTIVE prediction.
- [x] **[TEST-3] Research route error paths untested** — added "all three initial searches fail" test to research route test suite; verifies 200 with LLM fallback result even when every search rejects.

### Testing — Medium gaps

- [ ] **[TEST-4] Bot runner tests over-mocked** — `__tests__/services/bot-runner.test.ts` mocks Prisma, LLM, and RSS entirely. Add at least one test with a canned LLM JSON response (no mock) to catch schema drift between OpenRouter output and the bot's Zod parser.
- [ ] **[TEST-5] Background translation failure path** — `api/forecasts/route.ts:177` spawns a fire-and-forget translation with only `.catch(err => log.error())`. No test verifies the forecast is still created successfully when translation throws.
- [ ] **[TEST-6] `softDeleteComment` has no test** — add a test in `__tests__/services/` or `src/lib/services/comment.ts` test suite verifying soft delete marks the row, hides it from list queries, and does not send mention notifications post-delete.
- [ ] **[TEST-7] Slug collision retry exhaustion** — `src/lib/services/forecast.ts:188-195` retries slug generation up to 3 times. Only the happy path is tested; add a test that exhausts all 3 retries and asserts the error thrown.
- [ ] **[TEST-8] Notification dedup time-window boundary** — `src/lib/services/notification.ts:51-71` deduplicates within 1 hour. Add tests for exactly 59 min (should dedup), exactly 61 min (should not dedup), and exactly 60 min boundary.
- [ ] **[TEST-9] Commitment confidence boundary values** — `src/lib/services/commitment.ts:55-65` validates confidence ranges per `outcomeType`. Add tests for boundary values: 0, -100, +100 for BINARY; 0, 100 for MULTIPLE_CHOICE; and out-of-range values (e.g. 101, -101).

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

*Agents: Work through open tasks in priority order. SEC-1 through SEC-4 must be resolved before the next production deploy. Notify komap via Telegram when ready for review.*
