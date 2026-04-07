# TODO.md — Task Queue

*Last updated: April 7, 2026 · v1.8.22*

---

## Open Tasks

### SEO & Localization
- [ ] **DeepL Integration** — evaluate switching from LLM-based translation to DeepL API for lower cost and faster background pre-translation at scale.

### Reliability & Infrastructure
- [x] **Fix backup.yml** — fixed: `Environment=staging` → `Environment=prod` in `.github/workflows/backup.yml`.
- [x] **Fix staging NEXT_PUBLIC_APP_VERSION** — fixed: renamed `APP_VERSION` to `NEXT_PUBLIC_APP_VERSION` in `docker-compose.staging.yml` and `scripts/blue-green-deploy.sh`; added export to staging deploy step in `deploy.yml`.
- [x] **Migrate secrets to AWS Secrets Manager** — `scripts/fetch-secrets.sh` created; `blue-green-deploy.sh` calls it at startup; IAM policy updated to include `github_token`. **Manual step remaining**: store `.env` content in `daatan-env-prod` secret in AWS Console, then run `terraform apply` to apply IAM changes.
- [x] **Fix auto resolution** — Serper and Nimbleway API keys confirmed set in prod; web search fallback chain working.
- [ ] **Use proper timezones** — ensure all timestamps are handled correctly across different timezones (UTC vs local).
- [ ] **Pluggable Push Notification Architecture** — refactor current Web Push logic into an adapter-based system to prepare for future Firebase Cloud Messaging (FCM) / Mobile integration. [View Implementation Plan](/home/mark/.gemini/tmp/daatan/c10b5df1-1d26-4013-83e2-89e4cd440f9f/plans/pluggable-push-notifications.md)
- [ ] **GitHub Actions: Migrate to Node.js 24** — Node.js 20 actions are deprecated (removal scheduled for Sept 2026).
    - [ ] Update `actions/checkout`, `actions/setup-node`, `aws-actions/configure-aws-credentials`, and `docker/build-push-action` to versions supporting Node.js 24 once released.
    - [ ] Update `node-version` in `.github/workflows/deploy.yml` from `'20'` to `'24'`.
    - [ ] Verify full CI/CD pipeline (Build, Test, Deploy) on Node.js 24 environment.

### Features & UX
- [ ] **Rename user** — allow users to change their display name / username.
- [ ] **Delete account (right to be forgotten)** — allow users to permanently delete their account and all associated personal data (GDPR compliance).
- [ ] **Unlimited CU mode** — allow users (or specific roles) to commit without CU balance constraints; useful for power users, admins, or a premium tier.
- [ ] **Fix "Won't Happen" button visual bug** — visual issue with the "Won't Happen" commitment button; investigate and fix display.

---

## Upgrades (evaluate when ready)

- [ ] **Prisma 7** — major version available (5.22 → 7.x); review migration guide before upgrading.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
