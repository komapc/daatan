# TODO.md - Task Queue

## In Progress
<!-- Items currently being worked on -->

## Up Next
- [x] Show sign-in option on every screen when user is not logged in (2026-02-05)
- [x] Infra: Zero downtime CI/CD deployment (2026-02-05) - Blue-green deployment implemented
- [x] Mobile UX: Disable zoom-in (viewport settings) (2026-02-05)
- [x] UX: Unify prediction creation flow - Express as default, toggle to manual wizard (left panel + button should start express, add switch to manual mode) (2026-02-07)
- [x] Infra: Zero downtime version updates (update version without deployment downtime) (2026-02-07)
- [x] Predictions: Resolving mechanism (mark predictions as resolved, calculate accuracy) (2026-02-07)
- [x] Feed: Add filters (tags, resolved, awaiting resolution, open - default, closing soon) (2026-02-07)
- [x] Comments: Add commenting system for predictions/forecasts (threaded discussions, reactions) (2026-02-07)
- [x] Code Quality: Eliminate all compile-time warnings, runtime warnings, linter warnings and hints (2026-02-07)
- [x] SEO: Add unique slugs to all entities (users, predictions, forecasts) for better URLs (2026-02-07)
### 🔴 Critical (data safety & security)
<!-- All critical items resolved -->

### 🟠 High Priority (stability & correctness)
- [x] DB: Run `npx prisma generate` — Comment model not recognized by Prisma client (type errors in comments API routes) (2026-02-08)
- [x] DB: Create/verify migration files for Commitment and CuTransaction models — migrations applied manually to both DBs (2026-02-08)
- [ ] CI/CD: Add `concurrency` group to GitHub Actions deploy workflow — two rapid pushes to main can trigger simultaneous deploys that conflict
- [ ] Security: Add rate limiting middleware to sensitive API endpoints (commit, resolve, comments) — no rate limiting exists anywhere
- [ ] Infra: EC2 instance type is `t3.nano` (0.5GB RAM) but runs Nginx + 2 Next.js apps + PostgreSQL — upgrade to at least `t3.small` (2GB) or the containers will OOM
- [x] Code Quality: Fix version number drift — aligned all to package.json as single source of truth (2026-02-08)
- [x] Code Quality: Move `@prisma/client` from devDependencies to dependencies in package.json (2026-02-08)
- [ ] API: Resolve endpoint uses inline Zod schema that differs from shared `resolvePredictionSchema` (evidence links optional vs required) — use the shared schema
- [ ] Infra: Investigate/fix zero downtime on upgrade (still doesn't work properly)

### 🟡 Medium Priority (features & improvements)
- [ ] Profile: Prepare for adding custom avatar upload (S3 storage, DB schema, UI flow) - Spec ready
- [ ] i18n: Set up internationalization infrastructure (next-intl, no translations yet) - Spec ready
- [ ] Express Prediction: Binary predictions from free text with LLM + web search - Spec ready
- [ ] Predictions: Add voting/commitment functionality for users
- [ ] Predictions: Allow users to change their vote/commitment
- [ ] Predictions: Full-screen view when clicking prediction card (currently only shows in feed)
- [ ] SEO: Add unique slugs to all entities (users, predictions, forecasts) for better URLs
- [ ] Express Prediction: Multiple choice support (e.g., "who will win elections")
- [ ] Express Prediction: Numeric threshold support (e.g., "Bitcoin price by end of year")
- [ ] Express Prediction: Advanced types (order, date-based, conditional)
- [ ] Predictions: "Updated Context" feature - re-analyze situation with latest articles
- [ ] Localization: Add Hebrew translations (infrastructure ready)
- [ ] Express create forecast: Legacy forecast system with LLM assistance
- [ ] Admin: Admin panel for moderators/admins to remove/edit predictions and forecasts
- [ ] UX: Clarify Feed vs Forecasts screens (remove feed or explain difference, make Forecasts default)
- [ ] Notifications: Resolution feed/notifications for users with commitments on resolved predictions
- [ ] Users: Add user role flags (admin, resolver/moderator, potentially more roles)
- [ ] Commitments: Commitment history page with stats and performance metrics
- [ ] Commitments: Real-time commitment feed showing recent activity across predictions
- [ ] Commitments: Commitment leaderboard (accuracy, total correct, RS gained, most CU committed)
- [ ] Notifications: Browser notifications for commitment resolutions (high priority)
- [ ] Notifications: Email notifications for commitment resolutions (low priority)
- [ ] Admin: Plan admin panel/back office architecture and features
- [ ] SEO: Server-render the home feed page — currently `'use client'` with useEffect fetch, no SSR/SEO for the main entry point
- [ ] DB: Plan migration to sunset legacy Forecast/Vote/ForecastOption models — dual system adds complexity, Comment has polymorphic relations to both
- [ ] Architecture: Refactor to classical SPA with 2026 best practices - Needs discussion

### 🟢 Low Priority (hardening & polish)
- [ ] Code Quality: Eliminate all compile-time warnings, runtime warnings, linter warnings and hints
- [ ] Code Quality: Remove `any` types — CommitmentForm.tsx, ModeratorResolutionSection.tsx (unnecessary `as any` cast when types are already augmented in next-auth.d.ts)
- [ ] Code Quality: Remove unused `SearchResult` import in expressPrediction.ts
- [ ] Code Quality: Replace `console.error` in API routes with structured logging (e.g., pino)
- [ ] Security: Add Content-Security-Policy header to nginx config
- [ ] Security: Add HSTS header to staging nginx server block (only production has it currently)
- [ ] Nginx: Reduce `proxy_read_timeout` from 86400s (24h) to 60-120s unless WebSockets are needed
- [ ] DB: Add composite index on Comment `(predictionId, createdAt)` for common query pattern
- [ ] Infra: Add SSL certificate renewal monitoring/alerting — certbot runs in a loop but no alert if renewal fails
- [ ] Infra: Add DB migration rollback strategy — rollback.sh handles code but not schema changes
- [ ] CI/CD: verify-deploy.sh external step reads package.json version from runner checkout which may differ from deployed version — use health endpoint version instead
- [ ] CI/CD: Pre-commit hook runs full build + tests on every commit (slow) — consider moving to pre-push or using lint-staged
- [ ] Testing: Implement end-to-end tests using relevant frameworks (Playwright/Cypress)
- [ ] Testing: Add tests for commitment and resolution flows — critical business logic with zero test coverage
- [ ] Testing: Fix comments.test.ts — likely failing due to Prisma client type errors

## Completed
- [x] Security: Remove NEXTAUTH_SECRET from Docker build args — now only passed as runtime env var (2026-02-08)
- [x] Infra: Terraform state moved to S3 backend with DynamoDB locking, tfplan removed from git (2026-02-08)
- [x] Infra: EBS delete_on_termination set to false — volume survives EC2 termination (2026-02-08)
- [x] Infra: Removed docker system prune -af --volumes from deploy workflows (2026-02-08)
- [x] Infra: Separate staging database from production — added `postgres-staging` service with own volume + `daatan_staging` DB, updated deploy workflow and blue-green script (2026-02-08)
- [x] Add link to "retroanalysis" feature (2026-02-04)
<!-- Move items here when done, with date -->

---
*Agents: Work through "Up Next" items in order. Move to "In Progress" when starting. Move to "Completed" with date when done. Notify komap via Telegram when ready for review.*
