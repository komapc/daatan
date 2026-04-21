# TODO.md — Task Queue

*Last updated: April 20, 2026 · v1.10.22*

---

## Open Tasks

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. (Add an implementation plan under `docs/` when you start.)

### Code Quality & Architecture
- [ ] **Service layer for API routes** — ~105 direct `prisma.*` calls remaining across 47 files in `src/app/api/`. Pass 1 done (forecast + comment routes, PR #663). Continue extracting business logic into `src/lib/services/`.

### Features & UX
- [x] **Search** — forecast search by claim text + tags, sidebar icon, `/forecasts?q=` URL. PR #665.
- [ ] **Verbose forecast creation progress** — the creation flow (article fetch → AI content analysis → moderation → forecast save) can take 10–20 s with no feedback beyond a generic spinner. Add step-by-step status messages in the creation UI so the user knows what's happening at each stage (e.g. "Fetching article…", "Analysing content…", "Checking moderation…", "Saving forecast…").
- [ ] **Find similar forecasts** — tag/keyword-based similarity in two surfaces:
  1. **Forecast creation** — after the user fills in claim text and tags, query for 2–3 active forecasts sharing ≥1 tag or significant keyword overlap. Show as a "Similar forecasts — is yours a duplicate?" warning inline in the creation form before submit.
  2. **Forecast detail page** — "See also" section below the main card. Show 2–3 active forecasts with the highest tag overlap (same tags), falling back to keyword overlap in claim text (stop-word-filtered, ≥2 matching words). Exclude resolved/void forecasts and the current forecast itself.
  - **API**: `GET /api/forecasts/similar?id=<id>&limit=3` (for detail page) + inline query on creation client.
  - **Similarity logic** (v1): score = (shared tags × 3) + (shared claim keywords × 1), return top N by score descending.
  - **Future**: swap scoring function for embedding cosine similarity without changing the API surface.
  - **Not needed**: new DB columns or migrations — tags and claimText are already indexed.
- [ ] **Microservice for predictions** — defer until a concrete driver appears (independent scaling, separate deploy cadence, or team ownership split). Until then the operational cost (two deployables, auth, data sync, and failure modes) usually outweighs the benefit for a single-app codebase.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
