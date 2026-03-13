# TODO.md — Task Queue

*Last updated: March 13, 2026 · v1.7.56*

---

## Open Tasks

None — all tracked tasks complete!

---

## Upgrades (evaluate when ready)

- [x] **Auth.js v5** — Migrated from NextAuth 4 to Auth.js v5 beta. Standardized `auth()` helper usage across API routes and components. Updated middleware and testing mocks. (v1.7.37)
- [ ] **Prisma 7** — major version available (5.22 → 7.x); review migration guide before upgrading.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

## Long Term / Backlog

- [ ] **Infra: Split Production and Staging** — Currently both domains point to the same "Staging" IP/Server. Need to provision a dedicated Production EC2 + Elastic IP and migrate production containers/database to ensure true isolation.

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
