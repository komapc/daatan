# TODO.md - Task Queue

## Up Next

### P0 - Critical

- [x] **Merge bot PRs** — PR #325, #326, #327, #328 merged.
- [ ] **Apply migrations on production** — run `npx prisma migrate deploy` on production server.
- [ ] **Security: Upgrade Next.js to ≥14.2.35** — current `14.2.21` has a critical CVE: Authorization Bypass in Next.js Middleware (GHSA-f82v-jwr5-mffw) which directly affects `/admin` route protection. Also patches SSRF via middleware redirects, cache poisoning, DoS. Patch-only bump, no breaking changes.
- [ ] **Security: Fix unprotected JSON.parse on LLM output** — `src/app/api/admin/bots/route.ts:193` parses LLM response without Zod validation; `src/lib/services/bot-runner.ts:313,335,375` parse LLM JSON inside try-catch but with no type validation after parse. Add a Zod schema (`z.object({...})`) after each parse so silently wrong types (e.g. number where string expected) are caught before writing to DB.
- [ ] **Security: Sanitize tagFilter before LLM prompt injection** — `src/lib/services/bot-runner.ts:278` interpolates `tagFilter.join(', ')` directly into the LLM system prompt. An admin can inject arbitrary instructions via a tag value containing `\n`. Fix: strip non-slug characters (`[^a-z0-9-_]`) from each tag before interpolation.
- [ ] **Security: SSRF on newsSources / RSS feeds** — `src/lib/services/rss.ts:fetchFeed` accepts any string URL (including `file://`, `http://localhost`, `http://169.254.169.254`). The SSRF check in `scraper.ts` is not applied to RSS fetches. Fix: enforce HTTPS protocol + private-IP hostname block before calling `rss-parser` or `fetch`.

### P1 - High Priority

- [ ] **Security: Deleted users retain active sessions** — `src/lib/auth.ts` session callback returns stale session data when the DB user record is missing (deleted/suspended). Fix: return `null` from the session callback to force re-login, or add an `isActive` boolean field on `User`.
- [ ] **Security: IPv6 SSRF gap in scraper** — `src/lib/utils/scraper.ts:isPrivateIP` blocks IPv4 private ranges but misses IPv6 link-local (`fe80::/10`) and unique-local (`fc00::/7`) addresses. Add checks for these ranges alongside the existing `::1` check.
- [ ] **Perf: Fix N+1 in bot list endpoint** — `src/app/api/admin/bots/route.ts:87` executes 2 × N `botRunLog.count` queries (one per bot). Replace with a single `prisma.botRunLog.groupBy({ by: ['botId', 'action'], _count: true })` query then map results in memory.
- [ ] **Perf: Optimize leaderboard query** — `src/app/api/leaderboard/route.ts` loads all commitments for all public users into memory and filters/aggregates in JS. Replace with `commitment.groupBy` for CU sums and `commitment.findMany` filtered to resolved-only for accuracy stats.
- [ ] **Implement "Scoring rule"** (e.g. Brier score)

- [ ] **Bot: Prompt management & Staging-to-Prod Transfer (Option 2)** — define bots in code (`src/agents/bots/*.json` or `.ts`) as the ultimate source of truth. Server syncs DB from code on startup.  
  1. Admin UI is still a testing sandbox.
  2. Overrides in UI become easily exportable via an "Export as Code" button.
  3. Transferring to production means committing that JSON export to Git, getting PR review/history, and letting CI/CD sync the prod DB automatically.

### P2 - Medium Priority

- [ ] **Notifications system** (unified) — Remaining:
  - [ ] Email notifications (pick provider: SES, Resend, or Postmark)
  - [ ] Comment `@mentions`: parse `@username` in comment text, resolve to user, trigger `MENTION` notification

- [ ] **i18n: Wire translations into all components** — `messages/en.json` and `messages/he.json` both exist with ~103 keys and matching structure. However, many components still use hardcoded English strings instead of `useTranslations()`. Need to audit all UI text and replace with translation keys. Priority: navigation, buttons, form labels, error messages. *(✅ Nav and Settings wired. Still needs forms and error messages).*

- [ ] **i18n: Auto-translate user content** — automatic translation of user-generated forecasts, comments. Requires: translation API (Google Translate / DeepL), caching translated content, language detection, UI toggle for original vs translated text.

- [ ] **Infra: Separate Terraform state per environment** — currently both prod and staging share the same backend key (`prod/terraform.tfstate` in `main.tf`). Running `terraform apply -var-file=staging.tfvars` operates against the prod state. Fix: use Terraform workspaces or separate backend keys per environment. Requires careful `terraform state` migration. Do in a dedicated session with no concurrent changes.

- [ ] **CI/CD: Create `version-bump.yml` workflow** — no workflow exists, but `.husky/pre-commit` references `./scripts/check-version-bump.sh`. Either create the workflow and script, or remove the stale husky reference.

### P3 - Low Priority

- [ ] **Express Forecast: Polish** — add save-as-draft (persist to DB with `status: DRAFT`), regenerate button (re-call LLM with same prompt), inline field editing on review screen (edit title, resolution date, context before finalizing)

- [ ] **Express Forecast: Edit options** — on the express review screen, allow editing/removing/adding generated options before finalizing. Currently options are generated by LLM and accepted as-is.

- [ ] **Manual Forecast: Visual improvements** — enhance UI/UX of manual prediction creation flow. Current flow is functional but plain.

- [ ] **Express Forecast: Numeric threshold support** — e.g., "Bitcoin price above $100K by end of year". LLM generates numeric threshold options (ranges/buckets). Requires: `NUMERIC_THRESHOLD` outcome type handling in prompt, option generation, and resolution logic.

- [ ] **Express Forecast: Advanced types** — order predictions (rank outcomes), date-based (when will X happen), conditional (if X then Y). Each requires LLM prompt engineering + UI + resolution logic. Low priority until core types are solid.

- [ ] **Security: Add missing DB indexes** — `BotRunLog` is queried by `[botId, action, isDryRun, runAt]` but only has a `[botId]` index; `Commitment` leaderboard query benefits from a compound `[userId, cuReturned]` index. Add via Prisma `@@index`.
- [ ] **Security: outcomePayload has no schema** — `src/lib/validations/prediction.ts` accepts `z.record(z.string(), z.unknown())` for `outcomePayload`. MULTIPLE_CHOICE forecasts assume an `options` array that's never validated at creation time, causing silent type confusion on resolution. Add per-outcomeType Zod discriminated unions.
- [ ] **Security: Rate-limit context updates per user** — `src/app/api/forecasts/[id]/context/route.ts` throttles one update per 24h per forecast, but a user can spam parallel context updates on N forecasts simultaneously, driving unbounded LLM cost. Add a user-level rate limit (e.g. max 10 context updates/day across all forecasts).
- [ ] **Security: No bot-count limit** — `POST /api/admin/bots` has no cap on total bots. An admin can create 1000s of bots each auto-granted 100 CU. Add a configurable max-bot guard (e.g. 50).
- [ ] **Code: Replace console.error with logger in bots/route.ts** — `src/app/api/admin/bots/route.ts:201` uses `console.error()` instead of the pino `log.error()`. In a Docker container, console output is not structured and may be missed by log aggregators.
- [ ] **Code: Refactor inline LLM schemas to shared module** — `src/lib/services/bot-runner.ts:46-68` defines `forecastBatchSchema` and `voteDecisionSchema` inline. These should live in `src/lib/llm/schemas/` and be reused across `bot-runner.ts` and `bots/route.ts` to avoid drift.
- [ ] **Code: Cache session user in JWT** — `src/lib/auth.ts` session callback hits the DB on every authenticated request. Cache key user fields (role, cuAvailable, rs) in the JWT token with a short TTL (e.g. 5 min) to reduce DB load.
- [ ] **Code: Cap ?limit param in comments route** — `src/app/api/comments/route.ts` defaults limit to 50 but has no max cap; `?limit=10000` would load all comments. Add `Math.min(limit, 100)` consistent with other routes.
- [ ] **Security: Env var validation at startup** — `GEMINI_API_KEY` only logs a warning if missing at init (`src/lib/llm/index.ts` line 10), `SERPER_API_KEY` only checked at request time (`src/lib/utils/webSearch.ts`). Add a startup validation step (e.g., in `instrumentation.ts` or a custom server init) that fails fast if required env vars are missing.

- [x] **Security: Enforce CSP headers on staging** — switched `Content-Security-Policy-Report-Only` → `Content-Security-Policy` for the staging block in `nginx-ssl.conf` (PR #356). Production block still report-only; enforce once staging proves stable.
- [ ] **Security: Enforce CSP headers on production** — flip prod block in `nginx-ssl.conf` from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` once staging monitoring confirms no violations.

- [ ] **Infra: Optimize CI/CD Deployment Pipeline** — SSM polling timeouts (10min) and pre-deployment health checks already exist. Remaining:
  - [ ] Decouple Staging/Production deployments where safe (currently sequential via `needs: build`)
  - [ ] Implement build-caching for Next.js / Docker layer caching to speed up ECR image creation

- [ ] **Profile: Custom avatar upload** — S3 storage, new `avatarUrl` field on User model, upload UI on profile/settings page. Spec ready. Consider: image resizing (Sharp), max file size, accepted formats (JPEG/PNG/WebP).

- [ ] **Testing: Missing unit test coverage** — notable gaps found in code review:
  - `updateCommitment` / `removeCommitment` — zero test coverage (CU delta logic untested)
  - Admin routes (`/api/admin/forecasts`, `users`, `comments`) — no tests at all
  - Slug collision race condition (P2002 error path) — untested
  - Concurrent first-commitment race (`isFirstCommitment` / `lockedAt` logic) — untested

- [ ] **Testing: E2E tests** (Playwright) — no E2E tests exist. Priority flows: login, create forecast (express + manual), commit to forecast, comment, admin resolution. Set up Playwright config, CI integration, test database seeding.

- [ ] **About Window** — add an "About" modal/page accessible from settings or sidebar. Show: app version (from `/api/health`), git commit, build date, credits/attribution, link to GitHub repo.

### Verify / Check Later

- [ ] **Notifications: Validate Telegram notifications** — verify that Telegram notifications fire correctly on all 4 trigger points (publish, commit, comment, resolve) in both staging and production. Bot: @ScoopPredictBot (prod), @DaatanClawBot (staging). Channel: @ScoopPredict.

- [ ] **SEO: Slugs** — `Prediction` model has a `slug` field (optional, unique) and the API route (`/api/forecasts/[id]/route.ts`) supports lookup by both ID and slug. But the frontend route is `/forecasts/[id]/` and always uses numeric IDs in URLs. To use slugs: update `Link` hrefs to use `slug` instead of `id`, add slug generation on prediction creation, handle slug-based routing in the page component.

- [ ] **SEO: Server-render home feed** — `src/app/page.tsx` wraps `FeedClient` (a `'use client'` component) that fetches via `useEffect`. No SSR — content invisible to crawlers on initial load. To fix: convert to Server Component with server-side data fetch, or use React Server Components with streaming.

### Upgrades (evaluate when ready)

- [ ] **Next.js 15** — when stable + LTS. App Router improvements, React 19 features, Turbopack stable.
- [ ] **Auth.js v5** — successor to NextAuth.js 4. Breaking changes (new config format, middleware-based auth), needs migration plan.
- [ ] **Turbopack** — replace webpack when stable for production builds. Already available in Next.js dev mode.
- [ ] **Drizzle ORM** — evaluate as Prisma alternative (lighter runtime, faster queries, SQL-first API). Major migration effort.

---
*Agents: Work through "Up Next" items in priority order. Move to "In Progress" when starting. Notify komap via Telegram when ready for review.*
