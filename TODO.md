# TODO.md — Task Queue

*Last updated: March 15, 2026 · v1.7.68* (Infrastructure split complete)

---

## Open Tasks

### Reliability & Infrastructure
- [ ] **Type System: Global Strictness Audit**
  - **Goal:** Ensure the codebase leverages TypeScript's full safety potential.
  - **Implementation:** Scan for and eliminate unsafe `any` usages (especially in recent Auth and Bot migrations). Verify that `tsconfig.json` has `strict: true` and that API responses/database models are properly typed throughout the stack.
- [ ] **State Logic: Audit "Locked" CU Mechanism**
  - **Goal:** Deeply understand and validate the `cuLocked` (Committed Units) lifecycle.
  - **Implementation:** Review the database schema and service logic to ensure that CU remains "locked" during the active phase of a forecast and is correctly released or slashed upon resolution. Audit the bot voting logic to ensure it doesn't double-lock or leak locked state during high-concurrency periods.
- [ ] **Backup: Twice Daily Redundancy**
  - **Goal:** Ensure RPO (Recovery Point Objective) is reduced from 24h to 12h.
  - **Implementation:** Modify the `backup-db.sh` script on the server and update the `ubuntu` user's crontab. Add a second cron entry (e.g., at 3 AM and 3 PM). Ensure S3 sync paths correctly handle timestamped subfolders to prevent accidental overwrites.
- [ ] **Watchdog: 5-Minute Health Sentinel**
  - **Goal:** Real-time visibility into downtime before users report it.
  - **Implementation:** Create a standalone GitHub Action workflow or a lightweight n8n flow. Trigger every 5 minutes to `GET` the `/api/health` endpoint of both Staging and Production. Monitor for `200 OK` and a valid `status: ok` JSON response.
  - **Alerting:** On failure, fire an immediate critical alert to the **Daatan Updates** Telegram channel with the environment name and error code.
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
    2. ⏳ Configure automated twice-daily backups for staging (currently daily at 3 AM)
    3. ⏳ Set up health monitoring (5-minute watchdog for both instances)
    4. ⏳ Monitoring: Verify backup retention policies (30 days prod, 14 days staging)

### Features & UX
- [ ] **Telegram: Contextual Notification Links**
  - **Goal:** Increase engagement by allowing immediate navigation from alerts to the site.
  - **Implementation:** Update the `lib/services/telegram.ts` (or equivalent) to include Markdown-formatted links in the message body. 
  - **Format:** `[View Forecast](https://daatan.com/forecasts/slug-here)` or `[Reply to Comment](https://daatan.com/forecasts/slug#comment-id)`. Ensure links use the correct `BASE_URL` per environment.

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
