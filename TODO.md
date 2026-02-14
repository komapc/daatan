# TODO.md - Task Queue

## In Progress
<!-- Items currently being worked on -->

## Up Next

### 🔴 High Priority

- [x] **Security: Clean dead env vars from `.env`** — ~~`GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` are in `.env` but unused in code (project uses Serper now). Remove to reduce attack surface.~~ ✅ Removed

- [ ] **Admin & Roles System** (ASAP)
  - [x] Add `role` enum to User model (USER, RESOLVER, ADMIN), seed initial admins
  - [x] Role-based API middleware (admin-only, resolver-only route protection)
  - [x] Custom `/admin` page — forecasts management (list, search, edit, soft-delete)
  - [x] Admin: Comments management (list, search, delete)
  - [x] Admin: Users management (list, assign/revoke roles)
  - [x] Resolver capabilities: resolve forecasts + delete comments (inline UI + admin panel)
  - [x] UI indicators: admin/resolver badges on profiles, inline moderation controls

- [x] **Infra: Fix zero-downtime deploys** — ~~staging is down several minutes after merging PRs. Investigate deploy workflow + blue-green script, likely old container stopped before new one is healthy or DB restart during deploy~~ ✅ Fixed — blue-green script now uses Docker network alias swapping instead of stop→rename. Old container serves traffic until new container is health-checked, migrations pass, and network alias is swapped atomically.



- [ ] **Naming: Rename "Prediction" → "Forecast" everywhere** — DB models, API routes, file paths, components, types, UI text. Consolidate with legacy Forecast model sunset. Needs spec + careful migration plan for production data.

### 🟠 Medium Priority

- [ ] **Security: Rotate exposed API keys** — `.env` file contains real API keys (Gemini, Serper, Google Search). Verified `.env` is gitignored and not in repo history — keys are safe for now. Rotate when moving to Secrets Manager.

- [ ] **Commitments: Elaborate commitment/join forecast system** — define how users commit to forecasts, change commitments, what happens on resolution. Multiple open design questions.

- [ ] **Forecasts: Tags/domains system** — evolve single `domain` string to many-to-many tags. LLM auto-assigns during creation, user can edit. Existing domain values become initial tag set. Feed filtering by tags.

- [ ] **Forecasts: "Updated Context" feature** — "Analyze Context" button on forecast detail page. Re-searches latest articles, updates context. Forecast claim text never changes, only context evolves.

- [ ] **Notifications system** (unified)
  - [ ] In-app notifications page (`/notifications`)
  - [ ] Telegram channel integration
  - [ ] Browser push notifications
  - [ ] Email notifications
  - [ ] Settings page: per-user notification channel configuration
  - [ ] Triggers: commitment resolutions, comments on your forecasts, new commitments
  - [ ] Comment `@mentions`: when a comment includes `@username`, notify that user via their configured notification channels

- [ ] **UX: Merge Feed and Forecasts screens** — unify `/` and `/predictions` into single feed at `/`, redirect `/predictions` there

- [ ] **Commitments: History page** with stats and performance metrics
- [ ] **Commitments: Real-time activity feed** showing recent commitments across forecasts
- [ ] **Commitments: Leaderboard** (accuracy, total correct, RS gained, most CU committed)

- [ ] **i18n: Language picker + store preference** — add language selector in UI, store user preference in DB. Infrastructure setup with next-intl.
- [ ] **i18n: UI translations** — translate all static UI strings (buttons, labels, navigation). Start with Hebrew.
- [ ] **i18n: Auto-translate user content** — automatic translation of forecasts, comments. Hard questions: what if translation loses meaning? Show original + translation? Flag uncertain translations?

- [ ] **DB: Sunset legacy Forecast/Vote/ForecastOption models** — dual system adds complexity, Comment has polymorphic relations to both. Migrate old data to new system, drop old tables.

- [x] **Security: Inconsistent authorization on resolve endpoints** — ~~`forecasts/[id]/resolve` checks `isAdmin` only, while `predictions/[id]/resolve` checks `isModerator || isAdmin`. Standardize both to `isModerator || isAdmin`.~~ ✅ Fixed

- [x] **Code Quality: Fix `@ts-ignore` in `src/lib/auth.ts`** — ~~PrismaAdapter type mismatch. Fix the type properly instead of suppressing.~~ ✅ Cast as `Adapter` from next-auth/adapters

- [x] **Code Quality: Replace `any` types** — ~~found in `commitments/route.ts` (where clause), `ai/extract/route.ts` (error catch), `express/generate/route.ts` (onProgress callback), `expressPrediction.ts`. Use proper types.~~ ✅ Replaced with `Prisma.CommitmentWhereInput`, `Record<string, unknown>`, and `unknown`

- [x] **Code Quality: Standardize error responses** — ~~some routes return `{ error }`, others `{ error, details }`. Create a shared error response helper.~~ ✅ Fixed — created `src/lib/api-error.ts` with `apiError()` and `handleRouteError()`. All 20 API routes now use consistent shape: `{ error: string, details?: Array<{path, message}> }`.

- [x] **DB: Add `deletedAt` index on Comment model** — ~~soft-delete queries filter on `deletedAt: null` but there's no index for it. Add `@@index([deletedAt])`.~~ ✅ Fixed

- [x] **API: Add validation on `top-reputation` route** — ~~`limit` query param has no validation (could be negative or huge). Add Zod schema with `min(1).max(100)`.~~ ✅ Fixed

- [x] **API: Comment delete should also allow `isModerator`** — ~~currently only author or `isAdmin` can delete. Moderators should be able to delete too, consistent with resolve permissions.~~ ✅ Fixed

- [x] **CI/CD: Production deploy stops app+nginx before rebuild** — ~~`deploy-production` job runs `docker compose down app nginx` before building, causing downtime. Should use blue-green like staging does.~~ ✅ Fixed — now uses `blue-green-deploy.sh production` same as staging.

- [x] **CI/CD: Migration failure silently ignored** — ~~production deploy has `|| echo "⚠️ Migration failed..."` which swallows real migration errors. Should fail the deploy on migration errors. (Note: blue-green script has same issue in Phase 5)~~ ✅ Fixed — migrations now run BEFORE the traffic swap (Phase 5). If migration fails, the new container is cleaned up and old container keeps serving. Deploy exits with error code.

### 🟡 Low Priority

- [ ] **Express Forecast: Polish** — add save-as-draft, regenerate button, inline field editing on review screen
- [ ] **Express Forecast: Edit options** — add ability to edit/refine generated options before finalizing prediction
- [ ] **Manual Forecast: Visual improvements** — enhance UI/UX of manual prediction creation flow
- [ ] **Express Forecast: Multiple choice support** (e.g., "who will win elections")
- [ ] **Express Forecast: Numeric threshold support** (e.g., "Bitcoin price by end of year")
- [ ] **Express Forecast: Advanced types** (order, date-based, conditional)
- [ ] **Express create forecast**: Legacy forecast system with LLM assistance

- [ ] **Security: Rate limiting** — anti-flood on write endpoints, cost protection on LLM routes (express generate, AI extract). Nginx-level preferred.
- [ ] **Security: Content-Security-Policy header** in nginx config

- [ ] **Infra: Optimize CI/CD Deployment Pipeline**
  - [ ] Add 10-minute timeouts to SSM polling loops in `deploy.yml` to prevent hangs
  - [ ] Add pre-deployment SSM health checks to fail fast if agent is down
  - [ ] Decouple Staging/Production deployments where safe
  - [ ] Implement build-caching for Next.js to speed up ECR image creation

- [ ] **Profile: Custom avatar upload** (S3 storage, DB schema, UI flow) — Spec ready

- [x] **Code Quality: Eliminate all compile-time/runtime/linter warnings** — ~~Fixed ESLint warnings in admin tables (CommentsTable, ForecastsTable, UsersTable) by wrapping fetch functions in useCallback.~~ ✅ Fixed
- [ ] **Code Quality: Replace `console.error` with structured logging** (e.g., pino)
- [ ] **Code Quality: Inconsistent Prisma import pattern** — `comments/route.ts` and `comments/[id]/route.ts` use dynamic import wrapper (`getPrisma`), all other routes import singleton directly. Standardize to direct import.
- [x] **Code Quality: Move profile validation schema to `src/lib/validations/`** — ~~`updateProfileSchema` is defined inline in `profile/update/route.ts` instead of centralized like other domains.~~ ✅ Moved to `src/lib/validations/profile.ts`
- [ ] **Code Quality: Stub `fetchArticleContent()` in `webSearch.ts`** — returns empty string with console.warn. Either implement or remove.
- [ ] **Code Quality: Client error handling uses `alert()`** — `CommentForm.tsx` uses `alert()` for errors. Replace with proper error state UI across components.
- [ ] **Security: Missing env var validation at startup** — GEMINI_API_KEY, SERPER_API_KEY checked at request time, not at boot. Add startup validation.
- [ ] **Security: Remove `@types/pg` from devDependencies** — unused, Prisma handles DB connections.

- [ ] **Testing: E2E tests** (Playwright/Cypress)
- [x] **Testing: Commitment and resolution flow tests** — ~~critical business logic with zero coverage~~ ✅ Added comprehensive tests (9 commitment tests + 6 resolution tests)

- [ ] **Localization: Hebrew translations** (after i18n infrastructure is ready)

- [x] **Code Quality: Remove unused `pg` dependency** — ~~Prisma handles DB connections, `pg` package in `package.json` may not be needed directly. Verify and remove if unused.~~ ✅ Verified unused, removed
- [x] **Docs: `DEPLOYMENT_SUMMARY.md` is stale** — ~~references version 0.1.16 and "14/14 tests". Either keep it updated or remove it (it's a snapshot, not a living doc).~~ ✅ Removed
- [ ] **Docs: Remove `PRODUCT_NAMING.md` or archive** — references "ScoopBet" as proposed name, decision still pending. Low value as a root-level doc.
- [x] **Dockerfile: Clean up debug `RUN echo` statements** — ~~build stage has multiple `echo` and `ls -R` commands for debugging. Remove once builds are stable.~~ ✅ Removed debug echo/ls statements and stale BUILD_TIMESTAMP arg

- [ ] **About Window** — Add an "About" modal/page with app info, version, and credits.

### 🔵 Verify / Check Later
- [ ] **SEO: Slugs** — migration exists, verify URLs actually use slugs in production
- [ ] **SEO: Server-render home feed** — currently client-side fetch, no SSR. Lowest priority.

---
*Agents: Work through "Up Next" items in priority order. Move to "In Progress" when starting. Notify komap via Telegram when ready for review.*
