# TODO.md — Task Queue

*Last updated: April 29, 2026 · v1.10.54*

---

## Open Tasks

### Oracle / Search Unification

> Routes daatan's article search through oracle so both services share one provider fallback chain.
> ORACLE_URL + ORACLE_API_KEY must be set (key in AWS Secrets Manager: `openclaw/oracle-api-key`).

- [x] `src/lib/services/oracleSearch.ts` — thin client for `POST ${ORACLE_URL}/search` (v1.10.54, PR #699)
- [x] `context/route.ts` + `research/route.ts` — try oracle first, fall back to local `searchArticles` (v1.10.54, PR #699)
- [x] `notifyOracleSearchUnavailable()` in `telegram.ts` — 5-min cooldown alert on oracle failure (v1.10.54, PR #699)
- [x] **Health route** — `getOracleSearchHealth()` in `oracleSearch.ts` (v1.10.58, PR #703)
- [x] **Hourly cron** — `GET /api/cron/search-health` + `search-health.yml` GitHub Actions (v1.10.58, PR #703)
- [ ] **Env var rename** — retro PR #58 renamed `SERPAPI_KEY` → `SERPAPI_API_KEY` and `SERPERDEV_KEY` → `SERPER_API_KEY` in `web_search.py`. If daatan's `src/env.ts` or any `.env` files reference the old names, update them. (SM paths are unchanged.)

### Unified Analysis Pipeline (oracle articles passthrough)

> Oracle API now accepts `articles` in `POST /forecast` (retro PR #57, merged 2026-04-29).
> Goal: daatan passes the articles it already found (for prose context) directly to oracle,
> so the probability estimate and the context text are derived from the **same article set**.
> Currently daatan searches 4 articles for prose, then oracle independently searches 5 different
> articles for the probability — this fixes that inconsistency.

- [x] **`oracle.ts` — add `articles` param to `getOracleForecast`** (v1.10.57, PR #702)
- [x] **`context/route.ts` — pass found articles to oracle** (v1.10.57, PR #702)
- [x] **Verify end-to-end**: confirmed 2026-04-29 — `articlesUsed: 5` matches `resultCount: 5` from oracleSearch; same article set used for both prose and probability

---

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. (Add an implementation plan under `docs/` when you start.)

### Code Quality & Architecture
- [ ] **Service layer for API routes** — ✅ Complete. Pass 1 (forecast + comment, PR #663). Pass 2 (notifications, user/profile, leaderboard, tags, PR #680). Pass 3 (forecast CRUD, approve/reject/publish, comment CRUD+reactions, bot admin, user admin, push subscriptions, news anchors, auth signup/reset, commitments — v1.10.34). Pass 4 (context, research, health, backfill-rules, stats, commit/preview — v1.10.46). Zero direct `prisma.*` calls remain in API routes.

### Scoring Systems
- [ ] **Glicko-2 per-tag backfill** — existing users have global mu/sigma but no per-tag history. Consider whether to surface a "requires X predictions in this tag" notice on per-tag Glicko-2. (Deferred; the replay approach makes this optional.)
- [ ] **Polymarket integration (Phase 2)** — add `polymarketPrice Float?` to `Commitment` + `Prediction`; compute KL-divergence vs market at resolution. See `docs/EXPERTISE_RATING_SYSTEM.md` Phase 2.
- [x] **User profile: skill history chart** — μ ± σ SVG chart, on-the-fly replay, tag-filtered (v1.10.59, PR #704)

### Features & UX
- [ ] **Microservice for predictions** — defer until a concrete driver appears (independent scaling, separate deploy cadence, or team ownership split). Until then the operational cost (two deployables, auth, data sync, and failure modes) usually outweighs the benefit for a single-app codebase.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
