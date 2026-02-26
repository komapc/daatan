# TODO.md - Task Queue

## Up Next

### P0 - Critical

- [ ] **Apply migrations on production** — SSH into prod EC2, run `npx prisma migrate deploy`; any pending schema migrations are blocked until this runs.

- [ ] **Upgrade Next.js to ≥14.2.35** — CVE GHSA-f82v-jwr5-mffw: middleware auth bypass that lets unauthenticated requests reach `/admin/*`. Patch-only bump (`npm install next@14.2.35`), no breaking changes expected; run build + smoke-test after.

### P1 - High Priority

- [x] **Security: Deleted users retain active sessions** — `src/lib/auth.ts` session callback silently returns stale data when the DB user is gone; fix by returning `null` (forces re-login) or adding an `isActive` flag checked on every session refresh.

- [ ] **Security: IPv6 SSRF gap in scraper** — `isPrivateIP()` blocks IPv4 private ranges and `::1` but misses `fe80::/10` (link-local) and `fc00::/7` (unique-local); add those two checks to close the gap.

- [ ] **Perf: Fix N+1 in bot list endpoint** — `GET /api/admin/bots` fires 2 × N `botRunLog.count` queries (one CREATED_FORECAST + one VOTED per bot); replace with a single `groupBy([botId, action])` then map in memory.

- [ ] **Implement scoring rule (Brier score)** — add a computed `brierScore` per commitment and surface it on the leaderboard and profile; Brier = (probability − outcome)²; requires storing the numeric probability at commit time.

- [ ] **Bot: Prompt management & Staging-to-Prod Transfer** — define bots in code (`src/agents/bots/*.ts`) as source of truth; server upserts DB on startup so prod bots are version-controlled, PR-reviewed, and deployed via CI rather than manual UI copy-paste.

### P2 - Medium Priority

- [x] **Notifications: In-app system** — Prisma models, API routes, service layer, browser push service, service worker, frontend list + unread badge are all complete.

- [ ] **Infra: Generate and configure VAPID keys for browser push** — run `npx web-push generate-vapid-keys` and add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` to all environment configs; without these the push service silently no-ops. Users must also click "Connect" in Settings → Notifications to subscribe.

- [ ] **Notifications: Email + `@mentions`** — pick a transactional email provider (SES / Resend / Postmark), wire it into the existing notification service, and add `@username` mention parsing in comments that triggers a `MENTION` notification to the mentioned user.

- [ ] **i18n: Wire translations into all components** — `messages/en.json` and `messages/he.json` exist with ~103 keys but most components still use hardcoded English; audit all UI text and replace with `useTranslations()` calls (nav and settings already done; forms and error messages remain).

- [ ] **i18n: Auto-translate user content** — machine-translate user-generated forecast titles, details, and comments via Google Translate or DeepL; cache translations in DB; add a language-toggle UI on forecast cards and detail pages.

- [ ] **Infra: Separate Terraform state per environment** — prod and staging share `prod/terraform.tfstate`; applying staging vars modifies prod state. Fix: use workspaces or separate backend keys; requires a `terraform state` migration in a dedicated session with no concurrent deploys.

- [ ] **CI/CD: Create `version-bump.yml` workflow** — `.husky/pre-commit` calls `./scripts/check-version-bump.sh` which doesn't exist; either implement the script + workflow that enforces a version bump on `fix/` and `feat/` branches, or remove the stale hook reference.

### P3 - Low Priority

- [ ] **Feature: Private (unlisted) forecasts** — add `isPublic` boolean to `Prediction` (default `true`); filter feed/search/leaderboard to `isPublic: true`; show private forecasts to author only; add a toggle on the create and edit screens.

- [ ] **Security: Enforce CSP headers on production** — flip the prod nginx block from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` once staging monitoring (PR #356) confirms no violations.

- [ ] **Security: Add missing DB indexes** — `BotRunLog` is queried by `[botId, action, isDryRun, runAt]` but only has `[botId]`; `Commitment` benefits from `[userId, cuReturned]` for leaderboard aggregation; add both via Prisma `@@index`.

- [ ] **Security: outcomePayload has no schema** — `outcomePayload` accepts `z.record(z.string(), z.unknown())`; MULTIPLE_CHOICE forecasts assume an `options` array that's never validated at creation, causing silent type errors on resolution; add per-`outcomeType` Zod discriminated unions.

- [ ] **Security: Rate-limit context updates per user** — the 24h-per-forecast throttle can be bypassed by updating context on N forecasts simultaneously; add a user-level cap (e.g. 10 context updates/day across all forecasts) to bound LLM cost.

- [ ] **Security: No bot-count limit** — `POST /api/admin/bots` has no cap; an admin can spin up thousands of bots each auto-granted 100 CU; add a configurable guard (e.g. `MAX_BOTS=50`) checked before creation.

- [ ] **Security: Env var validation at startup** — `GEMINI_API_KEY` only warns at init, `SERPER_API_KEY` only fails at request time; add a startup check in `instrumentation.ts` that hard-fails if required keys are missing, so misconfigured deploys surface immediately.

- [ ] **Code: Cache session user in JWT** — `auth.ts` session callback hits the DB on every authenticated request; store `role`, `cuAvailable`, and `rs` in the JWT with a short TTL (~5 min) so most requests skip the DB round-trip.

- [ ] **Code: Cap `?limit` in comments route** — `GET /api/comments` defaults to 50 but has no max; `?limit=10000` would load all comments; add `Math.min(limit, 100)` consistent with other routes.

- [ ] **Code: Refactor inline LLM schemas to shared module** — `forecastBatchSchema` and `voteDecisionSchema` are defined inline in `bot-runner.ts`; move to `src/lib/llm/schemas/` and import from both `bot-runner.ts` and `bots/route.ts` to prevent drift.

- [ ] **Profile: Custom avatar upload** — S3 storage, new `avatarUrl` field on User, upload UI on settings page; include server-side image resizing (Sharp), 5 MB size cap, JPEG/PNG/WebP only.

- [ ] **Express Forecast: Polish** — save-as-draft (`status: DRAFT`), regenerate button (re-call LLM with same input), and inline field editing on the review screen before finalizing.

- [ ] **Express Forecast: Edit options** — let users edit, remove, or add options generated by LLM on the review screen before submitting a MULTIPLE_CHOICE forecast.

- [ ] **Testing: Missing coverage** — `updateCommitment` / `removeCommitment` CU delta logic is untested; admin routes (`/api/admin/forecasts`, `users`, `comments`) have no tests; slug collision (P2002) and concurrent first-commitment race (`lockedAt`) are untested.

- [ ] **Testing: E2E tests (Playwright)** — no E2E tests exist; priority flows: login, create forecast (express + manual), commit, comment, admin resolution; needs Playwright config, CI integration, and a seeded test DB.

- [ ] **About page** — modal or page accessible from settings/sidebar showing app version (from `/api/health`), git commit SHA, build date, and link to repo.

- [ ] **Notifications: Deduplicate** — `predictionId`, `commentId`, and `actorId` fields exist on the `Notification` model but deduplication logic is not implemented; duplicate notifications can accumulate for the same actor+event.

- [ ] **Notifications: Cleanup/archival** — notifications grow unbounded; add a cron/job to delete notifications older than 90 days.

### Verify / Check Later

- [ ] **Telegram notifications** — verify all 4 triggers (publish, commit, comment, resolve) fire correctly in both prod (@ScoopPredictBot → @ScoopPredict) and staging (@DaatanClawBot).

- [ ] **SEO: URL slugs** — `Prediction.slug` field and API lookup exist but the frontend always links by numeric ID; update `Link` hrefs to use slug, add slug generation on create, handle slug-based routing in the page component.

- [ ] **SEO: Server-render home feed** — `page.tsx` wraps a `use client` component that fetches via `useEffect`; content is invisible to crawlers; convert to a Server Component with server-side data fetch or RSC streaming.

### Upgrades (evaluate when ready)

- [ ] **Next.js 15** — App Router improvements, React 19, Turbopack stable; evaluate when LTS.
- [ ] **Auth.js v5** — breaking config changes from NextAuth 4; needs a dedicated migration plan.
- [ ] **Turbopack** — faster production builds; evaluate when stable.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; major migration effort, evaluate when Prisma becomes a bottleneck.

---
*Agents: Work through "Up Next" items in priority order. Move to "In Progress" when starting. Notify komap via Telegram when ready for review.*
