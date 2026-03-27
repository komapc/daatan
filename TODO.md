# TODO.md — Task Queue

*Last updated: March 27, 2026 · v1.7.161*

---

## Open Tasks

### SEO & Localization
- [ ] **Add Arabic (AR) and Turkish (TR) as source languages** — configure RSS/news sources in Arabic and Turkish so bots can ingest and create predictions from those feeds. Separate from UI translation: this is about the *input* side (what the bot reads), not the display language.
- [ ] **Add Esperanto (EO) to UI** — add `eo` locale to `src/i18n/config.ts`, create `messages/eo.json`, wire up the language picker. Esperanto is already the internal dev language; making it an official UI option is a small lift.
- [ ] **DeepL Integration** — evaluate switching from LLM-based translation to DeepL API for lower cost and faster background pre-translation at scale.
- [ ] **Localized RSS Feeds** — generate language-specific RSS feeds (e.g., `/he/feed.xml`) for local news aggregators.
- [ ] **Check multi-lingual indexing** — verify Hebrew and Russian forecast pages are indexed by Google; check GSC for coverage errors.

### Reliability & Infrastructure
- [ ] **Speed up PR merge & Deployment pipeline** — current cycle is taking too long during critical fixes.
    - [ ] Optimize `npm install` and `npm run build` in GitHub Actions using better caching or selective builds.
    - [ ] Evaluate "Quick Deploy" path for critical middleware/hotfixes that skips full ECR rebuilds when possible.
    - [ ] Reduce Vitest execution time by parallelizing tests or using `--changed` more aggressively in CI.
- [ ] **GitHub Actions: Migrate to Node.js 24** — Node.js 20 actions are deprecated (removal scheduled for Sept 2026).
    - [ ] Update `actions/checkout`, `actions/setup-node`, `aws-actions/configure-aws-credentials`, and `docker/build-push-action` to versions supporting Node.js 24 once released.
    - [ ] Update `node-version` in `.github/workflows/deploy.yml` from `'20'` to `'24'`.
    - [ ] Verify full CI/CD pipeline (Build, Test, Deploy) on Node.js 24 environment.

### Features & UX
- [ ] **Telegram updates** — end-to-end test of notification delivery after bot token refresh.
- [ ] **Add CU to all users** — run `scripts/grant-initial-cu.ts` on production (dry-run first); grants 100 CU to all existing users with 0 balance.

---

## Upgrades (evaluate when ready)

- [ ] **Prisma 7** — major version available (5.22 → 7.x); review migration guide before upgrading.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
