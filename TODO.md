# TODO.md - Task Queue

## Up Next

### P0 - Critical

- [ ] **DB: Sunset legacy Forecast/Vote/ForecastOption models** — dual system adds complexity, Comment has polymorphic relations to both. Migrate old data to new system, drop old tables. Blocks future velocity.

- [ ] **Security: Rate limiting** — no rate limiting on any API route. LLM routes (express generate, AI extract) are particularly expensive. Implement at Nginx level.

- [ ] **DB: Remove deprecated schema fields** — `User.isAdmin`, `User.isModerator`, `User.brierScore` have `@default` values and are no longer read/written by application code (migrated to `role` enum). Create Prisma migration to drop columns. `Vote.brierScore` stays (legacy system).

### P1 - High Priority

- [ ] **Commitments: Elaborate commitment/join forecast system** — define how users commit to forecasts, change commitments, what happens on resolution. Multiple open design questions.

- [ ] **Forecasts: Tags/domains system** — evolve single `domain` string to many-to-many tags. LLM auto-assigns during creation, user can edit. Existing domain values become initial tag set. Feed filtering by tags.

- [ ] **Forecasts: "Updated Context" feature** — "Analyze Context" button on forecast detail page. Re-searches latest articles, updates context. Forecast claim text never changes, only context evolves.

- [ ] **Code Quality: Adopt `withAuth` wrapper across remaining routes** — wrapper created in `api-middleware.ts`, demonstrated on `publish` and `commit` routes. Incrementally adopt on remaining ~18 protected routes.

- [ ] **Code Quality: Replace `console.error` with structured logging** (e.g., pino) — 37 unstructured console.* calls across src/

### P2 - Medium Priority

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
- [ ] **i18n: Auto-translate user content** — automatic translation of forecasts, comments.

- [ ] **CI/CD: Split `verify-deploy.sh`** — runs `docker logs` from GitHub Actions runner but containers don't exist there. Split into CI-safe health check and server-only log inspection.
- [ ] **CI/CD: Add production approval gate** — `environment: production` protection rule in GitHub with required reviewers.
- [ ] **CI/CD: Reconcile Dockerfile ARGs** — `NEXT_PUBLIC_APP_VERSION` passed but never declared; `GIT_COMMIT` declared but never passed.
- [ ] **CI/CD: Add version input for manual production deploys** — currently deploys `staging-latest` tag with no version selection.
- [ ] **CI/CD: Create `version-bump.yml` workflow** — or remove stale references from docs.
- [ ] **CI/CD: Centralize ECR registry** — hardcoded in 4+ places (workflow, compose files, rollback script).

### P3 - Low Priority

- [ ] **Express Forecast: Polish** — add save-as-draft, regenerate button, inline field editing on review screen
- [ ] **Express Forecast: Edit options** — add ability to edit/refine generated options before finalizing prediction
- [ ] **Manual Forecast: Visual improvements** — enhance UI/UX of manual prediction creation flow
- [ ] **Express Forecast: Multiple choice support** (e.g., "who will win elections")
- [ ] **Express Forecast: Numeric threshold support** (e.g., "Bitcoin price by end of year")
- [ ] **Express Forecast: Advanced types** (order, date-based, conditional)

- [ ] **Security: Content-Security-Policy header** in nginx config
- [ ] **Security: Missing env var validation at startup** — GEMINI_API_KEY, SERPER_API_KEY checked at request time, not at boot.

- [ ] **Infra: Optimize CI/CD Deployment Pipeline**
  - [ ] Add 10-minute timeouts to SSM polling loops in `deploy.yml` to prevent hangs
  - [ ] Add pre-deployment SSM health checks to fail fast if agent is down
  - [ ] Decouple Staging/Production deployments where safe
  - [ ] Implement build-caching for Next.js to speed up ECR image creation

- [ ] **Profile: Custom avatar upload** (S3 storage, DB schema, UI flow) — Spec ready

- [ ] **Code Quality: Client error handling uses `alert()`** — `CommentForm.tsx` uses `alert()` for errors. Replace with proper error state UI.

- [ ] **Testing: E2E tests** (Playwright)

- [ ] **Localization: Hebrew translations** (after i18n infrastructure is ready)

- [ ] **About Window** — Add an "About" modal/page with app info, version, and credits.

- [ ] **Docs: Consolidate overlapping documentation** — `TECH.md`, `DEPLOYMENT.md`, `INFRASTRUCTURE.md`, `STRUCTURE.md`, `DEPLOYMENT_CHECKLIST.md` have significant overlap. Consider consolidating into 2 files.

- [ ] **Docs: Populate MEMORY.md lessons learned** — section is empty

- [ ] **Docs: Update PRODUCT.md roadmap** — Phase 1 items still show in-progress from January 2026

### Verify / Check Later
- [ ] **SEO: Slugs** — migration exists, verify URLs actually use slugs in production
- [ ] **SEO: Server-render home feed** — currently client-side fetch, no SSR

### Upgrades (evaluate when ready)
- [ ] **Next.js 15** — when stable + LTS. App Router improvements, React 19 features
- [ ] **Auth.js v5** — successor to NextAuth.js 4. Breaking changes, needs migration plan
- [ ] **Turbopack** — replace webpack when stable for production builds
- [ ] **Drizzle ORM** — evaluate as Prisma alternative (lighter, faster, SQL-first)

---
*Agents: Work through "Up Next" items in priority order. Move to "In Progress" when starting. Notify komap via Telegram when ready for review.*
