# TODO.md — Task Queue

*Last updated: April 28, 2026 · v1.10.53*

---

## Open Tasks


---

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. (Add an implementation plan under `docs/` when you start.)

### Code Quality & Architecture
- [ ] **Service layer for API routes** — ✅ Complete. Pass 1 (forecast + comment, PR #663). Pass 2 (notifications, user/profile, leaderboard, tags, PR #680). Pass 3 (forecast CRUD, approve/reject/publish, comment CRUD+reactions, bot admin, user admin, push subscriptions, news anchors, auth signup/reset, commitments — v1.10.34). Pass 4 (context, research, health, backfill-rules, stats, commit/preview — v1.10.46). Zero direct `prisma.*` calls remain in API routes.

### Scoring Systems
- [ ] **Glicko-2 per-tag backfill** — existing users have global mu/sigma but no per-tag history. Consider whether to surface a "requires X predictions in this tag" notice on per-tag Glicko-2. (Deferred; the replay approach makes this optional.)
- [ ] **Polymarket integration (Phase 2)** — add `polymarketPrice Float?` to `Commitment` + `Prediction`; compute KL-divergence vs market at resolution. See `docs/EXPERTISE_RATING_SYSTEM.md` Phase 2.
- [ ] **User profile: skill history chart** — show μ ± σ trend over time (per tag or global). See `docs/EXPERTISE_RATING_SYSTEM.md` Phase 3.

### Features & UX
- [ ] **Microservice for predictions** — defer until a concrete driver appears (independent scaling, separate deploy cadence, or team ownership split). Until then the operational cost (two deployables, auth, data sync, and failure modes) usually outweighs the benefit for a single-app codebase.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
