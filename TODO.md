# TODO.md - Task Queue

## In Progress
<!-- Items currently being worked on -->

## Up Next

### P0 - Critical

- [ ] **Bug: MULTIPLE_CHOICE resolution is broken** — In `src/app/api/forecasts/[id]/resolve/route.ts` (lines 84-86), resolution logic only checks `commitment.binaryChoice` which is `null` for MC predictions. All MC commitments are scored as wrong. `correctOptionId` from validation schema is accepted but never used. `PredictionOption.isCorrect` is never updated. Fix: use `correctOptionId` to determine which option won, compare against `commitment.optionId`, and update `PredictionOption.isCorrect`.

- [ ] **DB: Sunset legacy Forecast/Vote/ForecastOption models** — Dual system adds complexity, Comment has polymorphic relations to both. Legacy routes moved to `src/app/api/legacy-forecasts/` but old models still live in schema. Migrate remaining data to new system, drop old tables.

### P1 - High Priority

- [ ] **Security: Rate limiting** — Anti-flood on write endpoints, cost protection on LLM routes (express generate, AI extract). Nginx-level preferred.

- [ ] **Commitments: Elaborate commitment/join forecast system** — Define how users commit to forecasts, change commitments, what happens on resolution. Multiple open design questions.

- [ ] **Forecasts: Tags/domains system** — Evolve single `domain` string to many-to-many tags. LLM auto-assigns during creation, user can edit. Existing domain values become initial tag set. Feed filtering by tags.

- [ ] **Code Quality: Extract auth boilerplate into shared wrapper** — Every protected API route repeats `getServerSession(authOptions)` + null check + role check (~10 lines). Create a `withAuth(handler, { role?: ... })` wrapper. Affects 20+ routes.

- [ ] **Code Quality: Standardize Prisma imports** — 14 API routes use unnecessary `getPrisma()` dynamic import wrapper. Standardize to direct singleton import (`import { prisma } from '@/lib/prisma'`). Routes: forecasts, legacy-forecasts, top-reputation, news-anchors, comments, commitments.

- [ ] **Code Quality: Refactor 380-line commit route** — `src/app/api/forecasts/[id]/commit/route.ts` is the largest API route. Extract business logic (CU validation, commitment creation, transaction recording) into a service layer.

### P2 - Medium Priority

- [ ] **Forecasts: "Updated Context" feature** — "Analyze Context" button on forecast detail page. Re-searches latest articles, updates context. Forecast claim text never changes, only context evolves.

- [ ] **UX: Merge Feed and Forecasts screens** — Unify `/` and `/forecasts` into single feed at `/`, redirect `/forecasts` there.

- [ ] **Notifications system** (unified)
  - [ ] In-app notifications page (`/notifications`)
  - [ ] Telegram channel integration
  - [ ] Browser push notifications
  - [ ] Email notifications
  - [ ] Settings page: per-user notification channel configuration
  - [ ] Triggers: commitment resolutions, comments on your forecasts, new commitments
  - [ ] Comment `@mentions`: when a comment includes `@username`, notify that user via their configured notification channels

- [ ] **Commitments: History page** with stats and performance metrics
- [ ] **Commitments: Real-time activity feed** showing recent commitments across forecasts
- [ ] **Commitments: Leaderboard** (accuracy, total correct, RS gained, most CU committed)

- [ ] **i18n: Language picker + store preference** — Add language selector in UI, store user preference in DB. Infrastructure setup with next-intl.
- [ ] **i18n: UI translations** — Translate all static UI strings (buttons, labels, navigation). Start with Hebrew.
- [ ] **i18n: Auto-translate user content** — Automatic translation of forecasts, comments. Hard questions: what if translation loses meaning? Show original + translation? Flag uncertain translations?

- [ ] **Code Quality: Replace `as any` in non-test code** — `src/app/profile/page.tsx` (ForecastCard props), `src/app/admin/AdminClient.tsx` (role update), `src/app/api/commitments/route.ts` (status enum). Fix with proper types.

- [ ] **Code Quality: Replace `console.error` with structured logging** (e.g., pino) — 37 `console.log/warn/error` calls across `src/` in non-test code. No request IDs, no log levels, no structure.

- [ ] **DB: Remove deprecated schema fields** — `User.isAdmin`, `User.isModerator`, `User.brierScore`, `Prediction.domain` are marked deprecated but still referenced in `src/lib/auth.ts`, `src/app/api/legacy-forecasts/`, `src/app/api/comments/[id]/route.ts`, `src/app/api/admin/users/[id]/route.ts`, `src/types/next-auth.d.ts`. Migrate all references to `role` enum before removing fields.

- [ ] **Security: Missing env var validation at startup** — GEMINI_API_KEY, SERPER_API_KEY checked at request time, not at boot. Add startup validation.

- [ ] **Security: Content-Security-Policy header** in nginx config

### P3 - Low Priority

- [ ] **Express Forecast: Polish** — Add save-as-draft, regenerate button, inline field editing on review screen
- [ ] **Express Forecast: Edit options** — Add ability to edit/refine generated options before finalizing
- [ ] **Manual Forecast: Visual improvements** — Enhance UI/UX of manual forecast creation flow
- [ ] **Express Forecast: Multiple choice support** (e.g., "who will win elections")
- [ ] **Express Forecast: Numeric threshold support** (e.g., "Bitcoin price by end of year")
- [ ] **Express Forecast: Advanced types** (order, date-based, conditional)
- [ ] **Express create forecast**: Legacy forecast system with LLM assistance

- [ ] **Profile: Custom avatar upload** (S3 storage, DB schema, UI flow) — Spec ready

- [ ] **Code Quality: Stub `fetchArticleContent()` in `webSearch.ts`** — Returns empty string with console.warn. Either implement or remove.
- [ ] **Code Quality: Client error handling uses `alert()`** — `CommentForm.tsx` uses `alert()` for errors. Replace with proper error state UI across components.

- [ ] **Testing: E2E tests** — Playwright config added in v1.1.1 with example spec. Expand to cover critical flows.

- [ ] **Localization: Hebrew translations** (after i18n infrastructure is ready)

- [ ] **About Window** — Add an "About" modal/page with app info, version, and credits.

- [ ] **Accessibility: Remove `userScalable: false`** from layout viewport — Prevents zoom on mobile, accessibility concern.

### CI/CD Improvements

- [x] **CI/CD: Add lint-staged for pre-commit** — ~~Replaced full `npm run lint` with lint-staged (only lint changed files). Faster pre-commit feedback.~~ Done
- [x] **CI/CD: Add `typecheck` script and CI step** — ~~Added `tsc --noEmit` as `npm run typecheck`. Runs in pre-push hook and CI pipeline before build. Catches type errors faster with clearer output.~~ Done
- [x] **CI/CD: Add security audit to CI** — ~~`npm audit --audit-level=critical` runs after install. Warns on vulnerabilities before production deploy.~~ Done
- [x] **CI/CD: Skip Docker build/push on PRs** — ~~ECR build/push steps now gated with `if: github.event_name != 'pull_request'`. Saves ECR storage and CI time.~~ Done
- [x] **CI/CD: Reorder CI steps for faster failure** — ~~Moved typecheck and lint before build. Type errors and lint failures now fail in ~10s instead of waiting for full build.~~ Done
- [x] **CI/CD: Fix Playwright config** — ~~Removed Carbonyl terminal browser dependency. Uses standard Chromium for E2E tests. Changed webServer from `npm run dev` to `npm run start` for production-like testing.~~ Done
- [ ] **CI/CD: Add Playwright E2E smoke tests to CI** — Config is ready. Needs postgres service in CI workflow and Playwright browser install step. Would catch SSR crashes and missing pages.
- [ ] **CI/CD: Docker build smoke test in CI** — After building Docker image, start it with docker-compose and hit `/api/health`. Would have prevented both Jan 2026 post-mortem incidents.
- [ ] **CI/CD: Split `verify-deploy.sh`** — Currently runs `docker logs` from GitHub Actions runner where no containers exist. Split into CI-safe health-check-only script and server-only log inspection script.
- [ ] **CI/CD: Add production approval gate** — No `environment: production` protection rule in GitHub. Add required reviewers for production deploys.
- [ ] **CI/CD: Reconcile Dockerfile ARGs with workflow** — `NEXT_PUBLIC_APP_VERSION` passed from workflow but never declared in Dockerfile. `GIT_COMMIT` declared in Dockerfile but not passed from workflow. Fix both.
- [ ] **CI/CD: Add version input for manual production deploys** — Manual dispatch currently uses `staging-latest` image tag with no version override. Risk of deploying unintended staging code.
- [ ] **CI/CD: `version-bump.yml` workflow** — Referenced in STRUCTURE.md and TECH.md but does not exist. Either create the workflow or remove stale references.
- [ ] **CI/CD: Centralize ECR registry reference** — `272007598366.dkr.ecr.eu-central-1.amazonaws.com` hardcoded in workflow, compose files, and rollback script. Extract to single variable.
- [ ] **CI/CD: Fix network fallback in `blue-green-deploy.sh`** — Uses hardcoded `app_default` instead of deriving from Docker Compose project name.

- [ ] **Infra: Optimize CI/CD Deployment Pipeline**
  - [ ] Add 10-minute timeouts to SSM polling loops in `deploy.yml` to prevent hangs
  - [ ] Add pre-deployment SSM health checks to fail fast if agent is down
  - [ ] Decouple Staging/Production deployments where safe
  - [ ] Implement build-caching for Next.js to speed up ECR image creation

### Documentation Cleanup

- [ ] **Docs: Update STRUCTURE.md and TECH.md for post-rename paths** — Still reference `src/app/api/predictions/`, `src/components/predictions/`, `version-bump.yml`, and `DEPLOYMENT_SUMMARY.md`. Update to match current codebase.
- [ ] **Docs: Remove duplicate Ollama docs** — `docs/OLLAMA_SETUP.md` and `docs/ollama-setup.md` are two files with the same topic. Merge into one.
- [ ] **Docs: Consolidate overlapping documentation** — `TECH.md`, `DEPLOYMENT.md`, `INFRASTRUCTURE.md`, `STRUCTURE.md`, and `DEPLOYMENT_CHECKLIST.md` have significant content overlap (architecture diagrams, deployment commands, env vars). Consider consolidating.
- [ ] **Docs: Update PRODUCT.md roadmap** — Phase 1 items still show in-progress from January 2026. Update to reflect current state.
- [ ] **Docs: Remove `PRODUCT_NAMING.md` or archive** — References "ScoopBet" as proposed name, decision made. Low value as root-level doc.

### Agent Config Cleanup

- [ ] **Agents: Create `.cursor/rules/`** — Cursor IDE has no project-specific rules. DAATAN domain conventions, safety rails, and coding standards are not surfaced to Cursor agents. Extract from `.agent/RULES.md`.
- [ ] **Agents: Deduplicate rules across systems** — "Never push to main", Next.js gotchas, git pager workaround, and decision-making style are each duplicated 3-5 times across `.agent/RULES.md`, `.agent/config.json`, `.kiro/steering/*.md`, and `agents/corvus/SOUL.md`. Consolidate into single source of truth.
- [ ] **Agents: Fix user identity** — `agents/corvus/USER.md` says "janwuf" but all other configs reference "Mark" / "komap" / "komapcc". Reconcile.
- [ ] **Agents: Sync MCP configs** — `.agent/config.json` and `.kiro/settings/mcp.json` define the same MCP servers. Update one, forget the other. Consolidate.

### Upgrades (evaluate when ready)

- [ ] **Upgrade: Next.js 14 → 15 + React 19** — Current version has a known security vulnerability. Next.js 15 brings stable Turbopack, improved caching, Server Actions. Migration effort: moderate (caching behavior changes, async params). Prerequisite for adopting Server Actions pattern.
- [ ] **Upgrade: NextAuth 4 → Auth.js v5** — v4 is in maintenance mode. v5 has simpler API, native RBAC patterns, better middleware. Would simplify custom role middleware. Do after Next.js 15 upgrade.
- [ ] **Evaluate: AWS Amplify Hosting or App Runner** — Current EC2 + Docker + Nginx + Certbot + blue-green scripts is significant ops burden for solo dev. AWS Amplify has native Next.js SSR support with git-push deploys. App Runner works with existing ECR. Either would eliminate most deployment scripts and Terraform.
- [ ] **Evaluate: Server Actions for mutations** — With Next.js 15, Server Actions could replace many `/api/` routes (create forecast, commit, resolve). Type-safe end-to-end, no fetch boilerplate, no `getPrisma()` wrapper issue. Evaluate after Next.js 15 upgrade.

### Verify / Check Later

- [ ] **SEO: Slugs** — Migration exists, verify URLs actually use slugs in production
- [ ] **SEO: Server-render home feed** — Currently client-side fetch, no SSR. Lowest priority.

---
*Agents: Work through "Up Next" items in priority order. Move to "In Progress" when starting. Notify komap via Telegram when ready for review.*
