# TODO.md - Task Queue

## In Progress
<!-- Items currently being worked on -->

## Up Next

### 🔴 High Priority

- [ ] **Admin & Roles System** (ASAP)
  - [ ] Add `role` enum to User model (USER, RESOLVER, ADMIN), seed initial admins
  - [ ] Role-based API middleware (admin-only, resolver-only route protection)
  - [ ] Custom `/admin` page — forecasts management (list, search, edit, soft-delete)
  - [ ] Admin: Comments management (list, search, delete)
  - [ ] Admin: Users management (list, assign/revoke roles)
  - [ ] Resolver capabilities: resolve forecasts + delete comments (inline UI + admin panel)
  - [ ] UI indicators: admin/resolver badges on profiles, inline moderation controls

- [ ] **Infra: Fix zero-downtime deploys** — staging is down several minutes after merging PRs. Investigate deploy workflow + blue-green script, likely old container stopped before new one is healthy or DB restart during deploy

- [ ] **Architecture: Refactor to classical SPA** with 2026 best practices — Spec ready at `.kiro/specs/spa-refactor/`

- [ ] **Naming: Rename "Prediction" → "Forecast" everywhere** — DB models, API routes, file paths, components, types, UI text. Consolidate with legacy Forecast model sunset. Needs spec + careful migration plan for production data.

### 🟠 Medium Priority

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

- [ ] **UX: Merge Feed and Forecasts screens** — unify `/` and `/predictions` into single feed at `/`, redirect `/predictions` there

- [ ] **Commitments: History page** with stats and performance metrics
- [ ] **Commitments: Real-time activity feed** showing recent commitments across forecasts
- [ ] **Commitments: Leaderboard** (accuracy, total correct, RS gained, most CU committed)

- [ ] **i18n: Language picker + store preference** — add language selector in UI, store user preference in DB. Infrastructure setup with next-intl.
- [ ] **i18n: UI translations** — translate all static UI strings (buttons, labels, navigation). Start with Hebrew.
- [ ] **i18n: Auto-translate user content** — automatic translation of forecasts, comments. Hard questions: what if translation loses meaning? Show original + translation? Flag uncertain translations?

- [ ] **DB: Sunset legacy Forecast/Vote/ForecastOption models** — dual system adds complexity, Comment has polymorphic relations to both. Migrate old data to new system, drop old tables.

### 🟡 Low Priority

- [ ] **Express Forecast: Polish** — add save-as-draft, regenerate button, inline field editing on review screen
- [ ] **Express Forecast: Multiple choice support** (e.g., "who will win elections")
- [ ] **Express Forecast: Numeric threshold support** (e.g., "Bitcoin price by end of year")
- [ ] **Express Forecast: Advanced types** (order, date-based, conditional)
- [ ] **Express create forecast**: Legacy forecast system with LLM assistance

- [ ] **Security: Rate limiting** — anti-flood on write endpoints, cost protection on LLM routes (express generate, AI extract). Nginx-level preferred.
- [ ] **Security: Content-Security-Policy header** in nginx config

- [ ] **Infra: Check EC2 memory usage** — t3.nano (0.5GB) runs Nginx + 2 Next.js + PostgreSQL. Check if actually hitting limits before upgrading.
- [ ] **Infra: SSL certificate renewal monitoring** — certbot runs in loop but no alert if renewal fails
- [ ] **Infra: DB migration rollback strategy** — rollback.sh handles code but not schema changes

- [ ] **Profile: Custom avatar upload** (S3 storage, DB schema, UI flow) — Spec ready

- [ ] **Code Quality: Eliminate all compile-time/runtime/linter warnings**
- [ ] **Code Quality: Replace `console.error` with structured logging** (e.g., pino)

- [ ] **Testing: E2E tests** (Playwright/Cypress)
- [ ] **Testing: Commitment and resolution flow tests** — critical business logic with zero coverage

- [ ] **Localization: Hebrew translations** (after i18n infrastructure is ready)

### 🔵 Verify / Check Later
- [ ] **SEO: Slugs** — migration exists, verify URLs actually use slugs in production
- [ ] **SEO: Server-render home feed** — currently client-side fetch, no SSR. Lowest priority.

---
*Agents: Work through "Up Next" items in priority order. Move to "In Progress" when starting. Notify komap via Telegram when ready for review.*
