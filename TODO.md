# TODO.md - Task Queue

## Up Next

### P0 - Critical

- [x] **Apply migrations on production** — All 22 migrations applied (last: `20260225000000_add_context_snapshots` applied 2026-02-25). Verified via `_prisma_migrations` table on 2026-02-26.

- [x] **Upgrade Next.js to ≥14.2.35** — CVE GHSA-f82v-jwr5-mffw: middleware auth bypass that lets unauthenticated requests reach `/admin/*`. Patch-only bump (`npm install next@14.2.35`), no breaking changes expected; run build + smoke-test after.

### P1 - High Priority

- [x] **Security: Deleted users retain active sessions** — `src/lib/auth.ts` session callback silently returns stale data when the DB user is gone; fix by returning `null` (forces re-login) or adding an `isActive` flag checked on every session refresh.

- [x] **Security: IPv6 SSRF gap in scraper** — `isPrivateIP()` blocks IPv4 private ranges and `::1` but misses `fe80::/10` (link-local) and `fc00::/7` (unique-local); add those two checks to close the gap.

- [x] **Perf: Fix N+1 in bot list endpoint** — `GET /api/admin/bots` fires 2 × N `botRunLog.count` queries (one CREATED_FORECAST + one VOTED per bot); replace with a single `groupBy([botId, action])` then map in memory.

- [x] **Implement scoring rule (Brier score)** — `probability Float?` and `brierScore Float?` added to Commitment; probability captured via `% yes` input in CommitmentForm; `brierScore = (probability − outcome)²` computed at resolution; avgBrierScore surfaced on leaderboard (sortable) and profile page.

- [ ] **Bot: Prompt management & Staging-to-Prod Transfer** — define bots in code (`src/agents/bots/*.ts`) as source of truth; server upserts DB on startup so prod bots are version-controlled, PR-reviewed, and deployed via CI rather than manual UI copy-paste.

### P2 - Medium Priority

- [x] **Notifications: In-app system** — Prisma models, API routes, service layer, browser push service, service worker, frontend list + unread badge are all complete.

- [x] **Infra: Generate and configure VAPID keys for browser push** — keys already present on server (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`). Verified 2026-02-26.

- [ ] **Notifications: Email + `@mentions`** — pick a transactional email provider (SES / Resend / Postmark), wire it into the existing notification service, and add `@username` mention parsing in comments that triggers a `MENTION` notification to the mentioned user.

- [x] **i18n: Wire translations into all components** — all major components and pages (`FeedClient`, `ForecastCard`, `CommitmentForm`, `leaderboard`, `commitments`, `activity`, `profile`, `create`) now use `useTranslations` / `getTranslations`; `messages/en.json` and `messages/he.json` extended with ~50 new keys.

- [x] **i18n: Auto-translate user content** — Gemini-backed translation service with DB cache (`PredictionTranslation`, `CommentTranslation`); translate endpoints at `POST /api/forecasts/[id]/translate` and `POST /api/comments/[id]/translate`; translate-toggle UI on forecast detail page and per-comment in `CommentItem`.

- [ ] **Infra: Separate Terraform state per environment** — prod and staging share `prod/terraform.tfstate`; applying staging vars modifies prod state. Fix: use workspaces or separate backend keys; requires a `terraform state` migration in a dedicated session with no concurrent deploys.

- [x] **CI/CD: Create `version-bump.yml` workflow** — `scripts/check-version-bump.sh` already exists and is wired into `.husky/pre-commit`. Verified 2026-02-26.

### P3 - Low Priority

- [ ] **Feature: Private (unlisted) forecasts** — Add `isPublic` boolean to `Prediction` (default `true`). Filter private forecasts from feed/search/leaderboard; show only to author + admins. Add privacy toggle on create/edit screens; consider shareable secret links for limited access.

- [ ] **Security: Enforce CSP headers on production** — flip the prod nginx block from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` once staging monitoring (PR #356) confirms no violations.

- [ ] **Security: Add missing DB indexes** — `BotRunLog` is queried by `[botId, action, isDryRun, runAt]` but only has `[botId]`; `Commitment` benefits from `[userId, cuReturned]` for leaderboard aggregation; add both via Prisma `@@index`.

- [ ] **Security: outcomePayload has no schema** — `outcomePayload` accepts `z.record(z.string(), z.unknown())`; MULTIPLE_CHOICE forecasts assume an `options` array that's never validated at creation, causing silent type errors on resolution; add per-`outcomeType` Zod discriminated unions.

- [ ] **Security: Schema validation for forecast creation** — Add Zod schemas for BINARY (yes/no), MULTIPLE_CHOICE (options array), and NUMERIC_THRESHOLD (min/max bounds) outcomes; validate at API entry point to prevent malformed forecasts and ensure type-safe resolution.

- [ ] **Security: Rate-limit context updates per user** — the 24h-per-forecast throttle can be bypassed by updating context on N forecasts simultaneously; add a user-level cap (e.g. 10 context updates/day across all forecasts) to bound LLM cost.

- [ ] **Security: No bot-count limit** — `POST /api/admin/bots` has no cap; an admin can spin up thousands of bots each auto-granted 100 CU; add a configurable guard (e.g. `MAX_BOTS=50`) checked before creation.

- [ ] **Security: Env var validation at startup** — `GEMINI_API_KEY` only warns at init, `SERPER_API_KEY` only fails at request time; add a startup check in `instrumentation.ts` that hard-fails if required keys are missing, so misconfigured deploys surface immediately.

- [ ] **Code: Cache session user in JWT** — `auth.ts` session callback hits the DB on every authenticated request; store `role`, `cuAvailable`, and `rs` in the JWT with a short TTL (~5 min) so most requests skip the DB round-trip.

- [ ] **Code: Cap `?limit` in comments route** — `GET /api/comments` defaults to 50 but has no max; `?limit=10000` would load all comments; add `Math.min(limit, 100)` consistent with other routes.

- [ ] **Code: Refactor inline LLM schemas to shared module** — `forecastBatchSchema` and `voteDecisionSchema` are defined inline in `bot-runner.ts`; move to `src/lib/llm/schemas/` and import from both `bot-runner.ts` and `bots/route.ts` to prevent drift.

- [ ] **Profile: Custom avatar upload** — S3 storage, new `avatarUrl` field on User, upload UI on settings page; include server-side image resizing (Sharp), 5 MB size cap, JPEG/PNG/WebP only.

- [ ] **Testing: Missing coverage** — `updateCommitment` / `removeCommitment` CU delta logic is untested; admin routes (`/api/admin/forecasts`, `users`, `comments`) have no tests; slug collision (P2002) and concurrent first-commitment race (`lockedAt`) are untested.

- [ ] **Testing: E2E tests (Playwright)** — no E2E tests exist; priority flows: login, create forecast (express + manual), commit, comment, admin resolution; needs Playwright config, CI integration, and a seeded test DB.

- [ ] **About page** — modal or page accessible from settings/sidebar showing app version (from `/api/health`), git commit SHA, build date, and link to repo.

- [ ] **Notifications: Deduplicate** — `predictionId`, `commentId`, and `actorId` fields exist on the `Notification` model but deduplication logic is not implemented; duplicate notifications can accumulate for the same actor+event.

- [ ] **Notifications: Cleanup/archival** — notifications grow unbounded; add a cron/job to delete notifications older than 90 days.

- [ ] **Notifications: MENTION type never triggered** — `NotificationType.MENTION` exists in the enum and schema but `createNotification()` is never called for it; implement `@username` mention parsing in comment creation (regex scan → look up username → fire `MENTION` notification).

- [ ] **Notifications: Silent UI errors** — `NotificationPreferences.tsx` and `NotificationList.tsx` both have empty `catch {}` blocks; users receive no feedback when saving preferences or loading more notifications fails; add error toasts.

- [ ] **Notifications: `dispatchBrowserPush()` has no retry** — called fire-and-forget without `await`; transient network failures silently lose pushes with no queue or backoff; consider a minimal retry (1–2 attempts with delay) or a persistent job queue.

- [ ] **Notifications: Batch DB updates in `dispatchBrowserPush()`** — for a user with N devices the function issues N separate `prisma.pushSubscription.update()` calls; replace with a single `updateMany` keyed on the IDs that succeeded.

- [ ] **Notifications: Add push subscription tests** — `POST /api/push/subscribe` and `DELETE` have no tests; also missing tests for `usePushSubscription` hook (subscribe flow, VAPID key handling, 410/404 cleanup, unauthorized access).

- [ ] **Analytics: Custom event tracking** — only automatic page views are tracked; add a `trackEvent` utility and instrument key user actions: sign-in, forecast creation (express vs manual), commitment, comment, resolution, and errors.

- [ ] **Analytics: User ID tracking** — authenticated users are not linked in GA4; call `gtag('config', id, { user_id })` after login so per-user journeys are visible in the GA console.

- [ ] **Analytics: GDPR/CCPA consent** — GA4 fires without user opt-in; implement a consent banner (`gtag('consent', 'default', { analytics_storage: 'denied' })` then update on acceptance) before the app is used in EU/CA markets.

### Verify / Check Later

- [ ] **Telegram notifications** — verify all 4 triggers (publish, commit, comment, resolve) fire correctly in both prod (@ScoopPredictBot → @ScoopPredict) and staging (@DaatanClawBot).

- [x] **SEO: URL slugs** — `Prediction.slug` field and API lookup exist; frontend updated to use slug-based links (`/forecasts/[slug]`), slug generation on create, and slug-based routing in the page component.

- [ ] **SEO: Server-render home feed** — `page.tsx` wraps a `use client` component that fetches via `useEffect`; content is invisible to crawlers; convert to a Server Component with server-side data fetch or RSC streaming.

### Upgrades (evaluate when ready)

- [ ] **Next.js 15** — App Router improvements, React 19, Turbopack stable; evaluate when LTS.
- [ ] **Auth.js v5** — breaking config changes from NextAuth 4; needs a dedicated migration plan.
- [ ] **Turbopack** — faster production builds; evaluate when stable.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; major migration effort, evaluate when Prisma becomes a bottleneck.

---
*Agents: Work through "Up Next" items in priority order. Move to "In Progress" when starting. Notify komap via Telegram when ready for review.*
