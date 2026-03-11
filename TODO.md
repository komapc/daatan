# TODO.md — Task Queue

*Last updated: March 2026 · v1.7.31*

---

## Open Tasks

### P3 — Low Priority / Nice to Have

- [ ] **Docs: VAPID key rotation runbook** — SECRETS.md documents key generation but not the operational procedure for rotating in production with zero subscription loss (grace period strategy).

---

## Upgrades (evaluate when ready)

- [ ] **Auth.js v5** — breaking config changes from NextAuth 4; needs a dedicated migration plan (adapter, session shape, callbacks).
- [ ] **Prisma 7** — major version available (5.22 → 7.x); review migration guide before upgrading.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

## Completed (archive)

<details>
<summary>All completed tasks — click to expand</summary>

### P0
- [x] Apply all 22 DB migrations to production (last: `20260225000000_add_context_snapshots`)
- [x] Upgrade Next.js to ≥14.2.35 (CVE GHSA-f82v-jwr5-mffw middleware auth bypass). Now on 15.5.12.

### P1
- [x] Separate Terraform state per environment (backend-staging.hcl / backend-prod.hcl)
- [x] Security: deleted users retain active sessions → session callback returns null
- [x] Security: IPv6 SSRF gap in scraper (fe80::/10, fc00::/7 added to isPrivateIP)
- [x] Perf: fix N+1 in bot list endpoint (groupBy instead of N count queries)
- [x] Implement Brier score (`probability Float`, `brierScore Float` on Commitment; leaderboard sorting)
- [x] Bot prompt management & staging-to-prod transfer (bots defined in code, upserted on startup)
- [x] Bedrock Phase 1 — Terraform IAM + SSM parameters for prompt ARNs
- [x] Bedrock Phase 1 — Create 4 prompts in Bedrock console (express, extract, suggest-tags, update-context)
- [x] Bedrock Phase 1 — Populate SSM params with Version 1 ARNs via promote-prompt.sh
- [x] Bedrock Phase 1 — App integration (`bedrock-prompts.ts`, 5-min TTL cache)
- [x] Bedrock Phase 1 — `scripts/promote-prompt.sh` with rollback support
- [x] Bedrock Phase 2 — migrate all 9 remaining inline prompts to Bedrock Prompt Management

### P2
- [x] **Security: No bot-count limit** — Added `MAX_BOTS` env var (default 50) and enforced it in `POST /api/admin/bots`. (v1.7.31)
- [x] **Testing: E2E auth-gated flows** — Created `tests/e2e/auth.setup.ts` and `tests/e2e/authenticated.spec.ts` with a `CredentialsProvider` bypass for automated test logins. (v1.7.31)
- [x] **Testing: Slug collision & lockedAt race** — Added unit tests in `__tests__/lib/race-conditions.test.ts` and `__tests__/lib/slugify.test.ts`. (v1.7.31)
- [x] **UX: Clickable username consistency** — Implemented `UserLink` across notifications, ForecastCard, and ForecastDetail pages. (v1.7.31)
- [x] **Code: Shared `PrimaryLink` component** — Created `src/components/ui/PrimaryLink.tsx` and refactored inline Tailwind link styles. (v1.7.31)
- [x] Notifications: in-app system (models, API, service, browser push, service worker, badge)
- [x] Notifications: email via Resend
- [x] Notifications: deduplication (same type+actor+prediction within 1h → update, not insert)
- [x] Notifications: cleanup/archival (90-day cron via `/api/cron/cleanup`)
- [x] Notifications: MENTION type wired in comments POST (`@username` parsing)
- [x] Notifications: silent UI errors → error toasts in NotificationPreferences + NotificationList
- [x] Notifications: dispatchBrowserPush retry + batch DB updates (updateMany / deleteMany)
- [x] Notifications: push subscription tests (13 tests)
- [x] Notifications: accessibility (`aria-label`, `aria-pressed` on NotificationList buttons)
- [x] Notifications: PATCH `/api/notifications/[id]` returns 404 on missing/unowned notification
- [x] Infra: generate and configure VAPID keys for browser push
- [x] i18n: wire translations into all components (en + he, ~50 keys)
- [x] i18n: auto-translate user content (Gemini-backed, DB cache, toggle UI)
- [x] Feature: private (unlisted) forecasts (`isPublic` + `shareToken`, filtered everywhere)
- [x] Fix: unlisted forecasts leaking into `?resolvedOnly` and `?status=` queries
- [x] Security: enforce CSP on production (flipped from Report-Only)
- [x] Security: add missing DB indexes (BotRunLog, Commitment)
- [x] Security: outcomePayload schema validation (superRefine per outcomeType)
- [x] Security: rate-limit context updates per user (10/day across all forecasts via prisma.count)
- [x] Security: env var validation at startup (`instrumentation.ts` hard-throws in production)
- [x] Code: shared Button component (variants, sizes, loading, Link integration)
- [x] Code: cache session user in JWT (cuAvailable, cuLocked, rs, username with 5-min TTL)
- [x] Code: cap `?limit` in comments route (`Math.min(limit, 100)`)
- [x] Code: refactor inline LLM schemas to `src/lib/llm/schemas/`
- [x] Profile: custom avatar upload (S3, Sharp resize, 5 MB cap, JPEG/PNG/WebP)
- [x] Analytics: custom event tracking (signIn, forecastCreated, commitmentMade, commentPosted)
- [x] Analytics: user ID tracking (`gtag set user_id`)
- [x] Analytics: GDPR/CCPA consent banner (GA4 defaults denied)
- [x] Testing: 769 tests across 61 files (commitment service, admin routes, forecast CRUD, notifications)
- [x] Testing: E2E smoke tests (Playwright — home, sign-in, 404, /api/health)
- [x] About page (version, commit SHA, build date, link to repo)
- [x] Docs: VAPID setup in SECRETS.md (key generation, build-time vs runtime, rotation caveats)
- [x] Fix: resolve form double-submit (success banner replaces form immediately on 200)
- [x] Feat: clickable usernames and avatars across the app (profile links, feed, comments)
- [x] Fix: preserve create-flow input on mode switch; refresh feed after forecast creation

### Verified
- [x] Telegram notifications wired (publish, commitment, comment, resolve; `[prod]`/`[staging]` prefix)
- [x] SEO: URL slugs (`/forecasts/[slug]`)
- [x] SEO: server-render home feed (SSR prefetch → initialPredictions to FeedClient)

</details>

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
