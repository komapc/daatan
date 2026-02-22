# TODO.md - Task Queue

## Up Next

### P0 - Critical

- [x] **Security: Rate limiting** — no rate limiting on any API route. LLM routes (`/api/forecasts/express/generate`, AI extract) are expensive (Gemini API calls + Serper searches per request). Implement at Nginx level using `limit_req_zone`. Consider tiered limits: stricter for LLM routes (~5 req/min), standard for other API routes (~60 req/min).

- [x] **Security: SSRF protection on URL fetching** — `fetchUrlContent()` in `src/lib/utils/scraper.ts` accepts arbitrary URLs with no validation. Any authenticated user can hit internal services (AWS IMDS `169.254.169.254`, localhost, Docker IPs). Fix: validate HTTPS-only, block RFC-1918/link-local ranges. Affects `/api/ai/extract` and express forecast URL flow.

### P1 - High Priority

- [x] **Commitments: Elaborate commitment/join forecast system** — define how users commit to forecasts, change commitments, what happens on resolution. (Fixed bot commitment block in v1.6.22)

- [x] **Code quality: URL hash inconsistency across 3 locations** — `news-anchors/route.ts` normalizes URL (lowercase, strip protocol/trailing slash) before hashing, but `forecasts/route.ts` and `expressPrediction.ts` hash the raw URL. Same URL produces different hashes → deduplication breaks. Extract a shared `hashUrl()` utility.

- [x] **Code quality: Admin routes use `where: any`** — `src/app/api/admin/forecasts/route.ts`, `users/route.ts`, `comments/route.ts` all use `where: any` instead of typed `Prisma.XxxWhereInput`. Typos in filter keys fail silently at runtime.

- [x] **Forecasts: "Updated Context" feature** — "Analyze Context" button on forecast detail page. Re-runs Serper web search for latest articles, updates the prediction's context field. Claim text never changes, only context evolves. Requires: new API route, rate limit on re-analysis (once per day?), show "context last updated" timestamp, diff view of old vs new context.

### P2 - Medium Priority

- [x] **Bug: No JS errors in frontend's console** — ensure no client-side runtime errors or warnings trigger in the browser console during regular usage.

- [x] **Commitments: Simplify putting commitment** — make the UX for committing to a forecast simpler and more intuitive.

- [x] **Infra: Make sure bots work, improve debugging** — ensure bot services are running correctly and enhance their logging visibility. (v1.6.22 fixed bot-related commitment block)

- [x] **Privacy: Activity feed leaks `isPublic: false` users** — `/api/commitments/activity` returns RS and activity for all users with no `isPublic` filter. Inconsistent with leaderboard which correctly filters. Add `where: { user: { isPublic: true } }`.

- [x] **Bug: Slug uniqueness TOCTOU race** — `POST /api/forecasts` does find-then-create for slugs (not atomic). Two concurrent requests with same `claimText` can produce duplicate slugs → unhandled P2002 error (500). Fix: catch P2002 and retry with incremented suffix.

- [x] **Code quality: Deprecate or remove `domain` field** — `Prediction.domain` is marked deprecated in schema, LLM prompt, and comments, but is still actively written everywhere. Either formally retire it (migration + remove from schemas) or un-deprecate.

- [x] **Code quality: Remove `any` types in frontend components** — `src/app/admin/CommentsTable.tsx` and other UI components use `any` arrays for state (e.g., `useState<any[]>([])`). Define proper TypeScript interfaces corresponding to the API responses to ensure type safety.


- [ ] **Notifications system** (unified) — Remaining:
  - [ ] Email notifications (pick provider: SES, Resend, or Postmark)
  - [ ] Comment `@mentions`: parse `@username` in comment text, resolve to user, trigger `MENTION` notification
  - **Done:** Telegram channel notifications (v1.4.19), in-app triggers (comments, commitments, resolve), browser push (service worker + Web Push API + VAPID), settings UI, unread badge, notifications page (v1.5.0)

- [ ] **i18n: Wire translations into all components** — `messages/en.json` and `messages/he.json` both exist with ~103 keys and matching structure. However, many components still use hardcoded English strings instead of `useTranslations()`. Need to audit all UI text and replace with translation keys. Priority: navigation, buttons, form labels, error messages. *(✅ Nav and Settings wired. Still needs forms and error messages).*

- [ ] **i18n: Auto-translate user content** — automatic translation of user-generated forecasts, comments. Requires: translation API (Google Translate / DeepL), caching translated content, language detection, UI toggle for original vs translated text.

- [ ] **CI/CD: Add production approval gate** — `deploy-production` job in `deploy.yml` has no `environment:` protection rule. Add `environment: production` with required reviewers in GitHub repo settings. Neither staging nor production jobs use GitHub Environments currently.

- [ ] **Infra: Separate Terraform state per environment** — currently both prod and staging share the same backend key (`prod/terraform.tfstate` in `main.tf`). Running `terraform apply -var-file=staging.tfvars` operates against the prod state. Fix: use Terraform workspaces or separate backend keys per environment. Requires careful `terraform state` migration. Do in a dedicated session with no concurrent changes.

- [ ] **CI/CD: Add version input for manual production deploys** — `workflow_dispatch` with `environment: production` currently deploys `staging-latest` tag with no version selection. Add a `version` input (string) so manual production deploys can target a specific tag. Update the image tag logic in `deploy-production` job.

- [ ] **CI/CD: Create `version-bump.yml` workflow** — no workflow exists, but `.husky/pre-commit` references `./scripts/check-version-bump.sh`. Either create the workflow and script, or remove the stale husky reference.

### P3 - Low Priority

- [ ] **Express Forecast: Polish** — add save-as-draft (persist to DB with `status: DRAFT`), regenerate button (re-call LLM with same prompt), inline field editing on review screen (edit title, resolution date, context before finalizing)

- [ ] **Express Forecast: Edit options** — on the express review screen, allow editing/removing/adding generated options before finalizing. Currently options are generated by LLM and accepted as-is.

- [ ] **Manual Forecast: Visual improvements** — enhance UI/UX of manual prediction creation flow. Current flow is functional but plain.

- [ ] **Express Forecast: Numeric threshold support** — e.g., "Bitcoin price above $100K by end of year". LLM generates numeric threshold options (ranges/buckets). Requires: `NUMERIC_THRESHOLD` outcome type handling in prompt, option generation, and resolution logic.

- [ ] **Express Forecast: Advanced types** — order predictions (rank outcomes), date-based (when will X happen), conditional (if X then Y). Each requires LLM prompt engineering + UI + resolution logic. Low priority until core types are solid.

- [x] **Assisted Resolving** — implement LLM-assisted or automated resolving mechanism to help admins quickly and accurately determine the outcome of mature forecasts. This might involve an admin UI button that queries Serper + LLM to propose a resolution state based on current news.

- [ ] **Security: Env var validation at startup** — `GEMINI_API_KEY` only logs a warning if missing at init (`src/lib/llm/index.ts` line 10), `SERPER_API_KEY` only checked at request time (`src/lib/utils/webSearch.ts`). Add a startup validation step (e.g., in `instrumentation.ts` or a custom server init) that fails fast if required env vars are missing.

- [ ] **Security: Enforce CSP headers** — CSP is currently `Content-Security-Policy-Report-Only` on staging/prod. Review browser console for violations, then change to `Content-Security-Policy` in `nginx-ssl.conf` and `nginx-staging-ssl.conf`. Tests exist in `__tests__/config/nginx-security-headers.test.ts`.

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

- [ ] **Docs: Populate MEMORY.md lessons learned** — section is empty (placeholder text only: "Update this as we learn things"). Add entries for: Docker build gotchas, Next.js App Router pitfalls, blue-green deployment learnings, Prisma migration lessons.

- [ ] **Docs: Update PRODUCT.md roadmap** — Phase 1 items still show as in-progress (🔄) from January 2026: "LLM-assisted prediction creation", "One-click prediction flow", "Coin economy basics", "Personal leaderboards". Update status to reflect current state (most are complete).

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
