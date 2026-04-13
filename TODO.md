# TODO.md — Task Queue

*Last updated: April 13, 2026 · v1.8.30*

---

## Open Tasks

### Reliability & Infrastructure
- [x] **Fix backup.yml** — fixed: `Environment=staging` → `Environment=prod` in `.github/workflows/backup.yml`.
- [x] **Fix staging NEXT_PUBLIC_APP_VERSION** — fixed: renamed `APP_VERSION` to `NEXT_PUBLIC_APP_VERSION` in `docker-compose.staging.yml` and `scripts/blue-green-deploy.sh`; added export to staging deploy step in `deploy.yml`.
- [x] **Migrate secrets to AWS Secrets Manager** — `scripts/fetch-secrets.sh` created; `blue-green-deploy.sh` calls it at startup; IAM policy updated to include `github_token`. **Manual step remaining**: store `.env` content in `daatan-env-prod` secret in AWS Console, then run `terraform apply` to apply IAM changes.
- [x] **Fix auto resolution** — Serper and Nimbleway API keys confirmed set in prod; web search fallback chain working.
- [x] **Use proper timezones** — fixed in v1.8.29: `localEndOfDay()` and `toLocalDatetimeInput()` utilities; all date inputs now interpreted in user's local timezone.
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. [View Implementation Plan](/home/mark/.gemini/tmp/daatan/c10b5df1-1d26-4013-83e2-89e4cd440f9f/plans/pluggable-push-notifications.md)
- [ ] **GitHub Actions: Migrate to Node.js 24** — Node.js 20 actions are deprecated (removal scheduled for Sept 2026).
    - [ ] Update `actions/checkout`, `actions/setup-node`, `aws-actions/configure-aws-credentials`, and `docker/build-push-action` to versions supporting Node.js 24 once released.
    - [ ] Update `node-version` in `.github/workflows/deploy.yml` from `'20'` to `'24'`.
    - [ ] Verify full CI/CD pipeline (Build, Test, Deploy) on Node.js 24 environment.

### Features & UX

*(all items resolved)*

---

## Upgrades (evaluate when ready)

- [x] **Prisma 7** — upgraded in v1.8.30: `prisma.config.ts` added, `schema.prisma` datasource url removed, Dockerfile updated.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
