# TODO.md — Task Queue

*Last updated: April 22, 2026 · v1.10.26*

---

## Open Tasks

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. (Add an implementation plan under `docs/` when you start.)

### Code Quality & Architecture
- [ ] **Service layer for API routes** — ~105 direct `prisma.*` calls remaining across 47 files in `src/app/api/`. Pass 1 done (forecast + comment routes, PR #663). Continue extracting business logic into `src/lib/services/`.

### i18n (untranslated components)
The following `'use client'` files have hardcoded English strings and do not use `next-intl`. Wire up `useTranslations` and add keys to all four locale files (en/ru/eo/he).

**User-facing (high priority):**
- [ ] `src/app/auth/signin/SignInClient.tsx`
- [ ] `src/app/auth/signup/SignupClient.tsx`
- [ ] `src/app/auth/forgot-password/page.tsx`
- [ ] `src/app/auth/reset-password/page.tsx`
- [ ] `src/app/auth/error/AuthErrorClient.tsx`
- [ ] `src/app/forecasts/page.tsx` (feed filters, search bar, empty states)
- [ ] `src/app/forecasts/express/ExpressForecastClient.tsx` (entire file — most text-heavy)
- [ ] `src/app/forecasts/[id]/_forecast/ResolutionInfo.tsx`
- [ ] `src/app/forecasts/[id]/_forecast/CommitmentsHistory.tsx`
- [ ] `src/app/forecasts/[id]/_forecast/BotApprovalSection.tsx`
- [ ] `src/app/forecasts/[id]/_forecast/SimilarForecasts.tsx`
- [ ] `src/app/forecasts/[id]/ForecastDetailClient.tsx` (partial — uses next-intl but ~8 strings remain hardcoded)
- [ ] `src/components/profile/ProfileEditForm.tsx`
- [ ] `src/components/settings/NotificationPreferences.tsx`
- [ ] `src/components/settings/DeleteAccountSection.tsx`
- [ ] `src/components/Sidebar.tsx` (partial — search strings hardcoded)

**Admin-only (lower priority):**
- [ ] `src/app/admin/AdminClient.tsx`
- [ ] `src/app/admin/AdminNav.tsx`
- [ ] `src/app/admin/BotsTable.tsx`
- [ ] `src/app/admin/_bots/CreateBotForm.tsx`
- [ ] `src/app/admin/_bots/EditBotModal.tsx`
- [ ] `src/app/admin/CommentsTable.tsx`

### Features & UX
- [ ] **Microservice for predictions** — defer until a concrete driver appears (independent scaling, separate deploy cadence, or team ownership split). Until then the operational cost (two deployables, auth, data sync, and failure modes) usually outweighs the benefit for a single-app codebase.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
