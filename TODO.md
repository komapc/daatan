# TODO.md — Task Queue

*Last updated: March 27, 2026 · v1.7.162*

---

## Open Tasks

### SEO & Localization
- [ ] **Add Arabic (AR) and Turkish (TR) as source languages** — configure RSS/news sources in Arabic and Turkish so bots can ingest and create predictions from those feeds. Separate from UI translation: this is about the *input* side (what the bot reads), not the display language.
- [ ] **DeepL Integration** — evaluate switching from LLM-based translation to DeepL API for lower cost and faster background pre-translation at scale.

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. [View Implementation Plan](/home/mark/.gemini/tmp/daatan/c10b5df1-1d26-4013-83e2-89e4cd440f9f/plans/pluggable-push-notifications.md)
- [ ] **GitHub Actions: Migrate to Node.js 24** — Node.js 20 actions are deprecated (removal scheduled for Sept 2026).
    - [ ] Update `actions/checkout`, `actions/setup-node`, `aws-actions/configure-aws-credentials`, and `docker/build-push-action` to versions supporting Node.js 24 once released.
    - [ ] Update `node-version` in `.github/workflows/deploy.yml` from `'20'` to `'24'`.
    - [ ] Verify full CI/CD pipeline (Build, Test, Deploy) on Node.js 24 environment.

### Features & UX
- [ ] **Unlimited CU mode** — allow users (or specific roles) to commit without CU balance constraints; useful for power users, admins, or a premium tier.
- [ ] **Fix "Won't Happen" button visual bug** — visual issue with the "Won't Happen" commitment button; investigate and fix display.

---

## Upgrades (evaluate when ready)

- [ ] **Prisma 7** — major version available (5.22 → 7.x); review migration guide before upgrading.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
