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

- [x] **Bedrock Phase 1 — Infra: Terraform IAM + SSM** — `terraform/bedrock_prompts.tf` created: `aws_iam_role_policy` with `bedrock:GetPrompt` + `ssm:GetParameter` on EC2 role; 8 `aws_ssm_parameter` resources (2 envs × 4 prompts) with `PLACEHOLDER` value and `ignore_changes = [value]`. `terraform validate` passes. **Next: run `terraform plan` then `terraform apply`.**

- [ ] **Bedrock Phase 1 — Create prompts in Bedrock console** — For each of the 4 file-based prompts, create a named prompt in Bedrock Prompt Management (eu-central-1): `daatan-express-prediction`, `daatan-extract-prediction`, `daatan-suggest-tags`, `daatan-update-context`. Paste text from existing `.ts` files, convert `${var}` → `{{var}}` (keep same variable names). Test in Bedrock playground, create Version 1, copy ARN.

- [ ] **Bedrock Phase 1 — Populate SSM params** — After creating Bedrock Version 1 for each prompt, run `./scripts/promote-prompt.sh staging <prompt> <arn>` and `./scripts/promote-prompt.sh prod <prompt> <arn>` to store version ARNs in SSM. Verify with `aws ssm get-parameter --name /daatan/prod/prompts/express-prediction`.

- [ ] **Bedrock Phase 1 — App integration** — Install `@aws-sdk/client-bedrock-agent` + `@aws-sdk/client-ssm`. Create `src/lib/llm/bedrock-prompts.ts` with: 5-min TTL in-memory cache, SSM fetch for ARN, Bedrock `GetPromptCommand` for template text, `fillPrompt()` helper for `{{var}}` substitution, hard crash on any fetch failure. Update call sites in `expressPrediction.ts`, `extractPrediction.ts`, `suggestTags.ts`, `updateContext.ts` to use `getPrompt()` + `fillPrompt()`. Delete the original prompt `.ts` files once all call sites are updated. Add `AWS_PROFILE=daatan` to local dev notes.

- [x] **Bedrock Phase 1 — Promote script** — `scripts/promote-prompt.sh` created and `chmod +x`; takes `(env, prompt-name, arn|--rollback)`; saves current ARN as SSM tag `previous-arn` before overwriting; `--rollback` swaps back using the tag.

- [ ] **Bedrock Phase 2 — Migrate inline prompts** — After Phase 1 is stable, migrate the 9 inline prompts from `bot-runner.ts`, `research/route.ts`, and `admin/bots/route.ts` to Bedrock. Bot-specific prompts (`forecastPrompt`, `votePrompt`) use a single Bedrock template per type with `{{personaPrompt}}`, `{{forecastPrompt}}`, `{{votePrompt}}` as runtime variables injected from DB at call time. Prompts to migrate: dedupe-check, bot-forecast-generation, forecast-quality-validation, bot-vote-decision, bot-config-generation, research-query-generation, resolution-research, translation, topic-extraction.

### P2 - Medium Priority

- [x] **Notifications: In-app system** — Prisma models, API routes, service layer, browser push service, service worker, frontend list + unread badge are all complete.

- [x] **Infra: Generate and configure VAPID keys for browser push** — keys already present on server (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`). Verified 2026-02-26.

- [ ] **Notifications: Email** — pick a transactional email provider (SES / Resend / Postmark) and wire it into the existing notification service (MENTION, COMMITMENT_RESOLVED, SYSTEM types are already flagged `email: true`).

- [x] **i18n: Wire translations into all components** — all major components and pages (`FeedClient`, `ForecastCard`, `CommitmentForm`, `leaderboard`, `commitments`, `activity`, `profile`, `create`) now use `useTranslations` / `getTranslations`; `messages/en.json` and `messages/he.json` extended with ~50 new keys.

- [x] **i18n: Auto-translate user content** — Gemini-backed translation service with DB cache (`PredictionTranslation`, `CommentTranslation`); translate endpoints at `POST /api/forecasts/[id]/translate` and `POST /api/comments/[id]/translate`; translate-toggle UI on forecast detail page and per-comment in `CommentItem`.

- [ ] **Infra: Separate Terraform state per environment** — prod and staging share `prod/terraform.tfstate`; applying staging vars modifies prod state. Fix: use workspaces or separate backend keys; requires a `terraform state` migration in a dedicated session with no concurrent deploys.

- [x] **CI/CD: Create `version-bump.yml` workflow** — `scripts/check-version-bump.sh` already exists and is wired into `.husky/pre-commit`. Verified 2026-02-26.

### P3 - Low Priority

- [x] **UX: Skeleton loaders on forecasts list page** — `src/app/forecasts/page.tsx` still shows a `Loader2` spinner; swap in `ForecastCardSkeleton` (already used in `FeedClient`) for consistent loading UX across forecast list views.

- [x] **Code: Shared `EmptyState` component** — the icon-circle + heading + description + CTA-link pattern is copy-pasted in ≥8 places (`FeedClient`, `leaderboard`, `profile`, `commitments`, `activity`, `NotificationList`, `forecasts/page`). Create `src/components/ui/EmptyState.tsx` with props `icon`, `iconBgClass`, `title`, `description`, `action?: { label, href }`, `variant?: 'card' | 'dashed'` and migrate all sites.

- [ ] **Code: Shared primary link/button component** — three slightly-different Tailwind class strings for blue CTA buttons are inline across the app. Create `src/components/ui/PrimaryLink.tsx` (or a `buttonVariants` helper) to prevent further drift.

- [x] **Feature: Private (unlisted) forecasts** — `isPublic Boolean @default(true)` + `shareToken String @unique` on `Prediction`. Filtered from feed, leaderboard, activity feed. Access gated by author/admin/shareToken URL. Visibility toggle on ForecastWizard (StepPublish), EditForecastClient, and ExpressForecastClient. Share-link banner shown to author on forecast detail page.

- [ ] **Security: Enforce CSP headers on production** — flip the prod nginx block from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` once staging monitoring (PR #356) confirms no violations.

- [x] **Security: Add missing DB indexes** — `@@index([botId, action, isDryRun, runAt])` added to `BotRunLog`; `@@index([userId, cuReturned])` added to `Commitment`; migration `20260227100000_add_missing_indexes` applied.

- [x] **Security: outcomePayload has no schema** — `createPredictionSchema` now uses `superRefine` to validate payload per `outcomeType`: MULTIPLE_CHOICE requires 2–10 option strings, NUMERIC_THRESHOLD requires metric/threshold/direction.

- [x] **Security: Schema validation for forecast creation** — covered by the `superRefine` above; BINARY requires no payload, MULTIPLE_CHOICE and NUMERIC_THRESHOLD validated at API entry point.

- [ ] **Security: Rate-limit context updates per user** — the 24h-per-forecast throttle can be bypassed by updating context on N forecasts simultaneously; add a user-level cap (e.g. 10 context updates/day across all forecasts) to bound LLM cost.

- [ ] **Security: No bot-count limit** — `POST /api/admin/bots` has no cap; an admin can spin up thousands of bots each auto-granted 100 CU; add a configurable guard (e.g. `MAX_BOTS=50`) checked before creation.

- [x] **Security: Env var validation at startup** — `src/instrumentation.ts` added; hard-throws on startup in production if `GEMINI_API_KEY`, `SERPER_API_KEY`, `VAPID_PRIVATE_KEY`, or `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are missing.

- [x] **Code: Cache session user in JWT** — `auth.ts` session callback still hits the DB on every authenticated request to fetch `cuAvailable`, `cuLocked`, `rs`, and `username`. `role` is already cached in the JWT token; extend caching to the remaining fields with a short TTL (~5 min) to skip the DB round-trip for most requests.

- [x] **Code: Cap `?limit` in comments route** — `GET /api/comments` defaults to 50 but has no max; `?limit=10000` would load all comments; add `Math.min(limit, 100)` consistent with other routes.

- [x] **Code: Refactor inline LLM schemas to shared module** — `forecastBatchSchema` and `voteDecisionSchema` are defined inline in `bot-runner.ts`; move to `src/lib/llm/schemas/` and import from both `bot-runner.ts` and `bots/route.ts` to prevent drift.

- [ ] **Profile: Custom avatar upload** — S3 storage, new `avatarUrl` field on User, upload UI on settings page; include server-side image resizing (Sharp), 5 MB size cap, JPEG/PNG/WebP only.

- [x] **Testing: Missing coverage** — 764 tests across 60 files. Added: commitment service (calculatePenalty, removeCommitment, updateCommitment), admin routes, GET/PATCH/DELETE /api/forecasts/[id] (incl. shareToken gate, isPublic toggle), EditForecastClient, ExpressForecastClient visibility, activity feed isPublic filter. Slug collision and lockedAt race still untested.

- [x] **Testing: E2E tests (Playwright)** — `playwright.config.ts` confirmed; `tests/e2e/smoke.spec.ts` covers home, sign-in, 404, and `/api/health`. Auth-gated flows (login, create, commit) still need a seeded test DB and auth fixtures.

- [x] **About page** — modal or page accessible from settings/sidebar showing app version (from `/api/health`), git commit SHA, build date, and link to repo.

- [x] **Notifications: Deduplicate** — `createNotification()` now checks for an unread notification with same `(userId, type, actorId, predictionId)` within the last hour; if found, updates `createdAt` + `message` instead of inserting a duplicate.

- [x] **Notifications: Cleanup/archival** — `cleanupOldNotifications(days=90)` added to notification service; `GET /api/cron/cleanup` route gated by `x-cron-secret` header; EC2 crontab entry documented in the route file.

- [x] **Notifications: MENTION type never triggered** — implemented `@username` mention parsing in `POST /api/comments`; regex scans comment text, looks up mentioned usernames, fires `MENTION` notification for each valid user (skips self + users already notified for that comment).

- [x] **Notifications: Silent UI errors** — `NotificationPreferences.tsx` and `NotificationList.tsx` both have empty `catch {}` blocks; users receive no feedback when saving preferences or loading more notifications fails; add error toasts.

- [x] **Notifications: `dispatchBrowserPush()` has no retry** — called fire-and-forget without `await`; transient network failures silently lose pushes with no queue or backoff; consider a minimal retry (1–2 attempts with delay) or a persistent job queue.

- [x] **Notifications: Batch DB updates in `dispatchBrowserPush()`** — for a user with N devices the function issued N separate `prisma.pushSubscription.update()` calls; replaced with a single `updateMany` for successes and `deleteMany` for stale subs.

- [x] **Notifications: Add push subscription tests** — 13 tests covering `POST` (create, upsert/key rotation, ownership transfer, validation) and `DELETE` (ownership scoping, idempotency, validation) in `src/app/api/push/subscribe/__tests__/route.test.ts`.

- [x] **Analytics: Custom event tracking** — `trackEvent` utility in `src/lib/analytics.ts`; `analytics.signIn/forecastCreated/commitmentMade/commentPosted` wired in SignInClient, ForecastWizard, CommitmentForm, CommentForm.

- [x] **Analytics: User ID tracking** — `identifyUser()` added to `analytics.ts`; `AnalyticsUserSync` component calls `gtag('set', { user_id })` once per authenticated session via `useSession`.

- [x] **Analytics: GDPR/CCPA consent** — `CookieConsent.tsx` consent banner mounted in root layout; GA4 defaults to `analytics_storage: denied` and updates on user acceptance.

### Verify / Check Later

- [x] **Telegram notifications** — code-verified: `notifyForecastPublished` (publish route), `notifyNewCommitment` (commitment service), `notifyNewComment` (comments route), `notifyForecastResolved` (resolve route) all wired; staging prefixed 🧪; fire-and-forget, never throws.

- [x] **SEO: URL slugs** — `Prediction.slug` field and API lookup exist; frontend updated to use slug-based links (`/forecasts/[slug]`), slug generation on create, and slug-based routing in the page component.

- [x] **SEO: Server-render home feed** — `page.tsx` is now an async Server Component that prefetches the default ACTIVE feed via internal fetch and passes `initialPredictions` to `FeedClient`; crawlers see forecast content on first load.

### Upgrades (evaluate when ready)

- [ ] **Next.js 15** — App Router improvements, React 19, Turbopack stable; evaluate when LTS.
- [ ] **Auth.js v5** — breaking config changes from NextAuth 4; needs a dedicated migration plan.
- [ ] **Turbopack** — faster production builds; evaluate when stable.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; major migration effort, evaluate when Prisma becomes a bottleneck.

---
*Agents: Work through "Up Next" items in priority order. Move to "In Progress" when starting. Notify komap via Telegram when ready for review.*
