# TODO.md - Task Queue

## Up Next

### P0 - Critical

- [ ] **DB: Sunset legacy Forecast/Vote/ForecastOption models** — dual system adds complexity. Legacy models (`Forecast`, `ForecastOption`, `Vote`) are fully replaced by new models (`Prediction`, `PredictionOption`, `Commitment`). ~8 files still reference old models:
  - 4 API routes under `src/app/api/legacy-forecasts/`
  - 1 validation file: `src/lib/validations/forecast.ts`
  - 1 test file: `__tests__/api/legacy-forecasts.test.ts`
  - `Comment` model has polymorphic relations (`predictionId` + `forecastId`) — both optional, exactly one set
  - Comments API (`/api/comments/route.ts`) accepts both `predictionId` and `forecastId`
  - Admin `CommentsTable.tsx` displays `forecast.title` in comment context
  - **Migration plan:** (1) migrate existing Forecast comments to Prediction comments, (2) remove `forecastId` from Comment model and API, (3) delete legacy API routes + validation + test, (4) drop old tables, (5) update admin UI

- [ ] **Security: Rate limiting** — no rate limiting on any API route. LLM routes (`/api/forecasts/express/generate`, AI extract) are expensive (Gemini API calls + Serper searches per request). Implement at Nginx level using `limit_req_zone`. Consider tiered limits: stricter for LLM routes (~5 req/min), standard for other API routes (~60 req/min).

### P1 - High Priority

- [ ] **Commitments: Elaborate commitment/join forecast system** — define how users commit to forecasts, change commitments, what happens on resolution. Open design questions: can users update commitment after placing? Time-lock before resolution? CU refund policy on cancellation? How do "Other" option commitments resolve in multiple-choice?

- [ ] **Forecasts: Tags/domains system** — evolve single `domain` string on `Prediction` to many-to-many tags. Requires: new `Tag` and `PredictionTag` Prisma models, LLM auto-assigns during express creation, user can edit on detail page. Existing `domain` values become seed tags. Feed filtering/search by tags. Consider: tag taxonomy (flat vs hierarchical), tag limit per prediction, popular tags sidebar.

- [ ] **Forecasts: "Updated Context" feature** — "Analyze Context" button on forecast detail page. Re-runs Serper web search for latest articles, updates the prediction's context field. Claim text never changes, only context evolves. Requires: new API route, rate limit on re-analysis (once per day?), show "context last updated" timestamp, diff view of old vs new context.

- [ ] **Analytics: Google Analytics 4** — component and infra ready (`src/components/GoogleAnalytics.tsx`, `docker-compose.prod.yml`). Disabled until GA properties are created. **To activate:** create two GA4 properties (production + staging) at analytics.google.com, add `GA_MEASUREMENT_ID_PROD` / `GA_MEASUREMENT_ID_STAGING` to server `.env`, restart containers, sync to Secrets Manager.

### P2 - Medium Priority

- [ ] **Notifications system** (unified) — Prisma schema, service layer (`src/lib/services/notification.ts`), and API routes (`/api/notifications`) are built. Types defined: `COMMITMENT_RESOLVED`, `COMMENT_ON_FORECAST`, `REPLY_TO_COMMENT`, `NEW_COMMITMENT`, `MENTION`, `SYSTEM`. `createNotification` exists but is never called outside tests. Remaining:
  - [ ] Wire notification triggers into commitment resolution, comments, new commitments
  - [ ] Telegram channel integration
  - [ ] Browser push notifications (service worker + Web Push API)
  - [ ] Email notifications (pick provider: SES, Resend, or Postmark)
  - [ ] Settings page: per-user notification channel configuration (UI for `NotificationPreference` model)
  - [ ] Comment `@mentions`: parse `@username` in comment text, resolve to user, trigger `MENTION` notification

- [ ] **i18n: Wire translations into all components** — `messages/en.json` and `messages/he.json` both exist with ~103 keys and matching structure. However, many components still use hardcoded English strings instead of `useTranslations()`. Need to audit all UI text and replace with translation keys. Priority: navigation, buttons, form labels, error messages.

- [ ] **i18n: Auto-translate user content** — automatic translation of user-generated forecasts, comments. Requires: translation API (Google Translate / DeepL), caching translated content, language detection, UI toggle for original vs translated text.

- [ ] **CI/CD: Add production approval gate** — `deploy-production` job in `deploy.yml` has no `environment:` protection rule. Add `environment: production` with required reviewers in GitHub repo settings. Neither staging nor production jobs use GitHub Environments currently.

- [ ] **CI/CD: Reconcile Dockerfile ARGs** — two mismatches in `Dockerfile` vs `deploy.yml` build-args:
  - `NEXT_PUBLIC_APP_VERSION` is passed in workflow build-args but never declared as `ARG` in Dockerfile (silently ignored)
  - `GIT_COMMIT` is declared as `ARG` in Dockerfile but never passed in workflow build-args (only set as env var during SSM deployment script)
  - **Fix:** either add `ARG NEXT_PUBLIC_APP_VERSION` to Dockerfile and pass `GIT_COMMIT` in build-args, or remove the unused references

- [ ] **CI/CD: Add version input for manual production deploys** — `workflow_dispatch` with `environment: production` currently deploys `staging-latest` tag with no version selection. Add a `version` input (string) so manual production deploys can target a specific tag. Update the image tag logic in `deploy-production` job.

- [ ] **CI/CD: Create `version-bump.yml` workflow** — no workflow exists, but `.husky/pre-commit` references `./scripts/check-version-bump.sh`. Either create the workflow and script, or remove the stale husky reference.

- [ ] **CI/CD: Centralize ECR registry** — registry URL `272007598366.dkr.ecr.eu-central-1.amazonaws.com` hardcoded in 4 files: `deploy.yml` (6 occurrences), `docker-compose.prod.yml` (2 occurrences), `scripts/blue-green-deploy.sh` (1, commented out). Extract to a single GitHub Actions variable or env var and reference everywhere.

### P3 - Low Priority

- [ ] **Express Forecast: Polish** — add save-as-draft (persist to DB with `status: DRAFT`), regenerate button (re-call LLM with same prompt), inline field editing on review screen (edit title, resolution date, context before finalizing)

- [ ] **Express Forecast: Edit options** — on the express review screen, allow editing/removing/adding generated options before finalizing. Currently options are generated by LLM and accepted as-is.

- [ ] **Manual Forecast: Visual improvements** — enhance UI/UX of manual prediction creation flow. Current flow is functional but plain.

- [ ] **Express Forecast: Numeric threshold support** — e.g., "Bitcoin price above $100K by end of year". LLM generates numeric threshold options (ranges/buckets). Requires: `NUMERIC_THRESHOLD` outcome type handling in prompt, option generation, and resolution logic.

- [ ] **Express Forecast: Advanced types** — order predictions (rank outcomes), date-based (when will X happen), conditional (if X then Y). Each requires LLM prompt engineering + UI + resolution logic. Low priority until core types are solid.

- [ ] **Security: Env var validation at startup** — `GEMINI_API_KEY` only logs a warning if missing at init (`src/lib/llm/index.ts` line 10), `SERPER_API_KEY` only checked at request time (`src/lib/utils/webSearch.ts`). Add a startup validation step (e.g., in `instrumentation.ts` or a custom server init) that fails fast if required env vars are missing.

- [ ] **Security: Enforce CSP headers** — CSP is currently `Content-Security-Policy-Report-Only` on staging/prod. Review browser console for violations, then change to `Content-Security-Policy` in `nginx-ssl.conf` and `nginx-staging-ssl.conf`. Tests exist in `__tests__/config/nginx-security-headers.test.ts`.

- [ ] **Infra: Optimize CI/CD Deployment Pipeline** — SSM polling timeouts (10min) and pre-deployment health checks already exist. Remaining:
  - [ ] Decouple Staging/Production deployments where safe (currently sequential via `needs: build`)
  - [ ] Implement build-caching for Next.js / Docker layer caching to speed up ECR image creation

- [ ] **Profile: Custom avatar upload** — S3 storage, new `avatarUrl` field on User model, upload UI on profile/settings page. Spec ready. Consider: image resizing (Sharp), max file size, accepted formats (JPEG/PNG/WebP).

- [ ] **Code Quality: Replace `alert()` with proper error UI** — `alert()` used for errors in 5 files, not just CommentForm:
  - `src/components/comments/CommentForm.tsx` (comment submission failure)
  - `src/app/forecasts/[id]/page.tsx` (forecast actions)
  - `src/components/forecasts/ForecastCard.tsx` (card actions)
  - `src/app/admin/CommentsTable.tsx` (admin comment actions)
  - `src/app/admin/UsersTable.tsx` (admin user actions)
  - Replace with toast notifications or inline error state UI.

- [ ] **Testing: E2E tests** (Playwright) — no E2E tests exist. Priority flows: login, create forecast (express + manual), commit to forecast, comment, admin resolution. Set up Playwright config, CI integration, test database seeding.

- [ ] **About Window** — add an "About" modal/page accessible from settings or sidebar. Show: app version (from `/api/health`), git commit, build date, credits/attribution, link to GitHub repo.

- [ ] **Docs: Populate MEMORY.md lessons learned** — section is empty (placeholder text only: "Update this as we learn things"). Add entries for: Docker build gotchas, Next.js App Router pitfalls, blue-green deployment learnings, Prisma migration lessons.

- [ ] **Docs: Update PRODUCT.md roadmap** — Phase 1 items still show as in-progress (🔄) from January 2026: "LLM-assisted prediction creation", "One-click prediction flow", "Coin economy basics", "Personal leaderboards". Update status to reflect current state (most are complete).

### Verify / Check Later

- [ ] **SEO: Slugs** — `Prediction` model has a `slug` field (optional, unique) and the API route (`/api/forecasts/[id]/route.ts`) supports lookup by both ID and slug. But the frontend route is `/forecasts/[id]/` and always uses numeric IDs in URLs. To use slugs: update `Link` hrefs to use `slug` instead of `id`, add slug generation on prediction creation, handle slug-based routing in the page component.

- [ ] **SEO: Server-render home feed** — `src/app/page.tsx` wraps `FeedClient` (a `'use client'` component) that fetches via `useEffect`. No SSR — content invisible to crawlers on initial load. To fix: convert to Server Component with server-side data fetch, or use React Server Components with streaming.

### Upgrades (evaluate when ready)

- [ ] **Next.js 15** — when stable + LTS. App Router improvements, React 19 features, Turbopack stable.
- [ ] **Auth.js v5** — successor to NextAuth.js 4. Breaking changes (new config format, middleware-based auth), needs migration plan.
- [ ] **Turbopack** — replace webpack when stable for production builds. Already available in Next.js dev mode.
- [ ] **Drizzle ORM** — evaluate as Prisma alternative (lighter runtime, faster queries, SQL-first API). Major migration effort.

---
*Agents: Work through "Up Next" items in priority order. Move to "In Progress" when starting. Notify komap via Telegram when ready for review.*
