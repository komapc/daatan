# TODO.md — Task Queue

*Last updated: March 17, 2026 · v1.7.92*

---

## Open Tasks

### Reliability & Infrastructure
- [x] **I18n: Translation Cache Implementation** (v1.7.104)
  - DB-level cache already in place (`PredictionTranslation`, `CommentTranslation` models, cache-aside in `translation.ts`).
  - Added cache invalidation: `deleteMany` on `predictionTranslation` when `claimText/detailsText/resolutionRules` edited; `deleteMany` on `commentTranslation` when comment text edited.
- [x] **Type System: Global Strictness Audit** (v1.7.71)
  - `strict: true` already set in tsconfig. Eliminated production `any` usages: `SearchResult` type in context route, typed `handleChange` in EditForecastClient, removed author casts in forecast page. Remaining `as any` are in test mocks (acceptable Vitest pattern).
- [x] **Analytics: Resolve Google Analytics Blocking** (v1.7.71 — won't fix)
  - **Decision:** `net::ERR_BLOCKED_BY_CLIENT` is expected behaviour — ad-blockers intentionally block `google-analytics.com`. The app loads GA non-blocking and never throws. A real fix requires a server-side DNS proxy, which is a significant infrastructure change. Accepted as known limitation.
- [x] **Backup: Twice Daily Redundancy** (v1.7.71)
  - `.github/workflows/backup.yml` triggers `backup-db.sh` via SSM at 03:00 and 15:00 UTC. RPO now ≤ 12h. Telegram alert on failure.
- [x] **Watchdog: 5-Minute Health Sentinel** (v1.7.71)
  - `.github/workflows/watchdog.yml` runs every 5 min on both prod and staging. Checks: `/api/health` (app + DB ping), `/`, `/forecasts`, `/leaderboard`, `/auth/signin`. Health endpoint now returns `db: true/false` and HTTP 503 on DB failure. Telegram alert with direct link on any failure.
- [x] **Infra: Split Production and Staging — 100% Complete** (v1.7.68)
  - **Goal:** Stop "Resource Thrashing" by isolating production and staging on separate instances.
  - **Completion Status (as of 2026-03-15 00:58 UTC):**
    - ✅ **Phase 1 - Emergency Recovery:** Rebooted crashed t3.small (i-0286f62b47117b85c), production back online
    - ✅ **Phase 2 - Database Backups:** Both prod & staging DBs backed up to S3 with recovery snapshots
    - ✅ **Phase 3 - Production Isolation:** Staging stopped on t3.small; production now isolated and stable (5+ hours uptime)
    - ✅ **Phase 4 - Instance Upgrade:** Upgraded t3.nano (i-04ea44d4243d35624) to t3.small (0.5GB → 2GB RAM)
    - ✅ **Phase 5 - Staging Deployment:** All staging containers running on upgraded t3.small, DBs restored from backup
    - ✅ **Phase 6 - DNS & Networking:** DNS updated; staging.daatan.com → 3.126.238.216 (production → 63.182.198.80)
    - ✅ **Phase 7 - HTTP Verification:** Staging responding on HTTP, all health checks passing
    - ✅ **Phase 8 - HTTPS Completion:** Self-signed SSL certs created for staging.daatan.com; port bindings fixed; HTTPS verified (2026-03-15 10:34 UTC)
    - ✅ **Phase 9 - Terraform Documentation:** Updated ec2.tf, route53.tf, s3.tf, outputs.tf; created INFRASTRUCTURE_SPLIT.md (2026-03-15 10:40 UTC)
  - **Infrastructure State:**
    - **Production (i-0286f62b47117b85c):** t3.small, 63.182.198.80, HTTPS ✅, daatan.com, mission.daatan.com
    - **Staging (i-04ea44d4243d35624):** t3.small, 3.126.238.216, HTTPS ✅, staging.daatan.com
  - **Completed (Post-Split):**
    1. ✅ Set up HTTPS certificates on staging instance (self-signed)
    2. ✅ Update Terraform to document the two-instance architecture
    3. ✅ Fixed docker port bindings (0.0.0.0:80 and 0.0.0.0:443 now properly exposed)
  - **Final Steps (Post-Split):**
    1. ✅ Upgrade HTTPS certificates to Let's Encrypt (2026-03-15 10:44 UTC) — staging.daatan.com now has valid Let's Encrypt cert (expires 2026-06-13)
    2. ✅ Twice-daily backups via `.github/workflows/backup.yml` (03:00 + 15:00 UTC)
    3. ✅ 5-minute watchdog via `.github/workflows/watchdog.yml` (prod + staging)
    4. ⏳ Monitoring: Verify backup retention policies (30 days prod, 14 days staging)

### Features & UX
- [x] **Telegram: Contextual Notification Links** (v1.7.71)
  - All 6 notification functions now append `<a href="...">View forecast →</a>` using `NEXTAUTH_URL` for the base (env-aware). HTML parse mode already enabled.

---

## Upgrades (evaluate when ready)

- [x] **Auth.js v5** — Migrated from NextAuth 4 to Auth.js v5 beta. Standardized `auth()` helper usage across API routes and components. Updated middleware and testing mocks. (v1.7.37)
- [ ] **Prisma 7** — major version available (5.22 → 7.x); review migration guide before upgrading.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

## Completed (archive)

<details>
<summary>All completed tasks — click to expand</summary>

### AI & Moderation
- [x] **AI: Block offensive forecasts and comments** — Implemented an AI-driven moderation layer using Gemini to detect and block hate speech, violence, and other policy violations in forecasts and comments. (v1.7.56)
- [x] **AI: "Guess" chances** — Added AI probability estimation in express mode based on source analysis. (v1.7.53)

### Features & UX
- [x] **UX: Regenerate button after editing in express mode** — Users can now edit a generated claim and re-trigger the research/extraction to update details. (v1.7.53)
- [x] **Fix: Robust forecast lookups** — Standardized all routes to support both ID and Slug lookups, fixing broken links. (v1.7.53)
- [x] **Admin: Unified Panel** — Consolidated admin tools into a single tabbed interface (Forecasts, Bots, Users, etc). (v1.7.53)

### Administrative
- [x] **Domain ownership verification** — Added Route53 TXT record for `google-site-verification` and restored SPF records. Successfully verified domain-level ownership. (v1.7.56)
- [x] **SEO optimization** — Implemented dynamic `sitemap.xml`, `robots.txt`, canonical URLs, and JSON-LD structured data. (v1.7.47)

### P1 — Infrastructure & Testing (Quality Focus)
- [x] **Safety: Version Integrity** — Added pre-commit hook to ensure package.json and version.ts are always in sync. (v1.7.53)
- [x] **Speed: Optimize local dev loop** — Removed `next build` from local pre-push and switched to `vitest related`. (v1.7.31)
- [x] **Coverage: Automated tracking** — Configured Vitest with `v8` and established thresholds (80% global, 90% services). (v1.7.31)
- [x] **Safety: DB Integration Pattern** — Implemented `docker-compose.test.yml` and integration helper for testing against real Postgres. (v1.7.31)
- [x] **Safety: E2E "Golden Path"** — Implemented comprehensive Playwright test for the core user journey. (v1.7.31)

### P0
- [x] Apply all 22 DB migrations to production (last: `20260225000000_add_context_snapshots`)
- [x] Upgrade Next.js to ≥14.2.35 (CVE GHSA-f82v-jwr5-mffw middleware auth bypass). Now on 15.5.12.

...

</details>

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
