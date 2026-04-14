# TODO.md — Task Queue

*Last updated: April 14, 2026 · v1.8.32*

---

## Open Tasks

### Reliability & Infrastructure
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. [View Implementation Plan](/home/mark/.gemini/tmp/daatan/c10b5df1-1d26-4013-83e2-89e4cd440f9f/plans/pluggable-push-notifications.md)
- [ ] **GitHub Actions: Migrate to Node.js 24** — Node.js 20 actions are deprecated (removal scheduled for Sept 2026).
    - [ ] Update `actions/checkout`, `actions/setup-node`, `aws-actions/configure-aws-credentials`, and `docker/build-push-action` to versions supporting Node.js 24 once released.
    - [ ] Update `node-version` in `.github/workflows/deploy.yml` from `'20'` to `'24'`.
    - [ ] Verify full CI/CD pipeline (Build, Test, Deploy) on Node.js 24 environment.

### Features & UX
- [ ] **Speedometer wrong value** — with 2 persons voting 2 vs 100, it shows 50% instead of the correct weighted value.
- [ ] **Microservice for predictions** — consider extracting prediction/forecast logic into a dedicated microservice.

---

## Upgrades (evaluate when ready)

- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
