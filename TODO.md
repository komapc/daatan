# TODO.md — Task Queue

*Last updated: March 27, 2026 · v1.7.160*

---

## Open Tasks

### SEO & Localization (v1.7.141)
- [ ] **Verify Bing indexing** — code is correct (msvalidate tag in layout, sitemap configured, robots.ts clean); check Bing Webmaster Tools for crawl lag or coverage errors.
- [ ] **Add Arabic (AR) and Turkish (TR) as source languages** — configure RSS/news sources in Arabic and Turkish so bots can ingest and create predictions from those feeds. Separate from UI translation: this is about the *input* side (what the bot reads), not the display language.
- [ ] **Add Esperanto (EO) to UI** — add `eo` locale to `src/i18n/config.ts`, create `messages/eo.json`, wire up the language picker. Esperanto is already the internal dev language; making it an official UI option is a small lift.
- [ ] **DeepL Integration** — evaluate switching from LLM-based translation to DeepL API for lower cost and faster background pre-translation at scale.
- [ ] **Localized RSS Feeds** — generate language-specific RSS feeds (e.g., `/he/feed.xml`) for local news aggregators.

### Reliability & Infrastructure
- [ ] **Speed up PR merge & Deployment pipeline** — current cycle is taking too long during critical fixes.
    - [ ] Optimize `npm install` and `npm run build` in GitHub Actions using better caching or selective builds.
    - [ ] Evaluate "Quick Deploy" path for critical middleware/hotfixes that skips full ECR rebuilds when possible.
    - [ ] Reduce Vitest execution time by parallelizing tests or using `--changed` more aggressively in CI.
- [ ] **GitHub Actions: Migrate to Node.js 24** — Node.js 20 actions are deprecated (removal scheduled for Sept 2026).
    - [ ] Update `actions/checkout`, `actions/setup-node`, `aws-actions/configure-aws-credentials`, and `docker/build-push-action` to versions supporting Node.js 24 once released.
    - [ ] Update `node-version` in `.github/workflows/deploy.yml` from `'20'` to `'24'`.
    - [ ] Verify full CI/CD pipeline (Build, Test, Deploy) on Node.js 24 environment.
- ✅ **Monitoring: Verify backup retention policies** — confirmed: prod 30 days, staging 14 days, both enabled on S3 lifecycle rules
- ✅ **Phase 4 IaC: Split docker-compose and nginx configs per environment** — `docker-compose.staging.yml` and `infra/nginx/nginx-prod-ssl.conf` created; deploy jobs send per-environment files; `blue-green-deploy.sh` uses `$COMPOSE_FILE`; `check-env-parity.sh` updated for split files.
- ✅ **Terraform: Remove SSH port from security group** — port 22 ingress rule removed; `allowed_ssh_cidr` variable removed; all access via SSM.
- ✅ **Telegram bot token refresh** — updated to @DaatanClawBot token in GitHub Actions secret + both Secrets Manager entries; containers restarted.

### Features & UX
- ✅ **Source-free predictions** — `source: 'manual'` is now set when no news anchor is provided; "Personal" badge shown on forecast cards and detail pages.
- ✅ **Bug: Edit button changes input field background to white** — fixed
- ✅ **Bug: Prediction filter too strict** — fixed
- ✅ **Bug: Speedometer shows wrong value** — fixed
- ✅ **Bug: Forecast detail layout overflow** — switched two-column grid to xl: (1280px+) so right column always has full 360px; PR #538 + #540
- ✅ **Console messages** — replaced `console.error` in CommitmentsPage with structured `createClientLogger`; PR #539
- ✅ **Google Analytics warnings** — added full GA4 consent mode v2 fields (`functionality_storage`, `personalization_storage`, `security_storage`, `wait_for_update: 500`); PR #539
- ✅ **Add CU to all users** — `scripts/grant-initial-cu.ts` ready; grants 100 CU + INITIAL_GRANT ledger entry to all non-bot users at 0; PR #539
- ✅ **Page loading optimization** — investigated; ISR already on forecast detail pages; no critical issues found; missing loading.tsx skeletons are a medium-effort improvement if needed
- ✅ **Bing warnings** — code config correct; no code changes needed; monitor Bing WMT directly
- [ ] **Check multi-lingual indexing** — verify Hebrew and Russian forecast pages are indexed by Google; check GSC for coverage errors
- [ ] **Telegram updates** — token was refreshed (see Reliability section) but delivery should be re-verified end-to-end

---

## Upgrades (evaluate when ready)

- [ ] **Prisma 7** — major version available (5.22 → 7.x); review migration guide before upgrading.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
