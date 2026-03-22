# TODO.md — Task Queue

*Last updated: March 22, 2026 · v1.7.129*

---

## Open Tasks

### Reliability & Infrastructure
- ⏳ **Monitoring: Verify backup retention policies** — 30 days prod, 14 days staging
- [ ] **Phase 4 IaC: Split docker-compose and nginx configs per environment** — `docker-compose.prod.yml` and `infra/nginx/nginx-ssl.conf` currently contain combined prod+staging service definitions and are deployed unchanged to both EC2 instances. Should be split into `docker-compose.staging.yml` (staging-only services) and per-environment nginx configs (`nginx-prod.conf` / `nginx-staging.conf`). Deploy jobs in `deploy.yml` need to send the correct file per target. Currently harmless (blue-green deploy only touches the right service; nginx uses variable upstreams), but wrong architecturally and will bite on fresh instance bootstrap.
- [ ] **Terraform: Remove SSH port from security group or restrict further** — `terraform/security_groups.tf` still allows port 22 from two IP ranges. Primary access is SSM; evaluate whether the SSH ingress rule is still needed.
- [ ] **Telegram bot token refresh** — `TELEGRAM_BOT_TOKEN` in `.env` returns 401 (invalid). Needs refresh from BotFather.

### Features & UX
- [ ] **Bug: Edit button changes input field background to white** — input field background flashes/changes to white when "Edit" is clicked; should retain correct styling.
- [ ] **Bug: Prediction filter too strict** — "Will Moldova attack Romania?" is blocked; geopolitical questions should be allowed. Filter is over-eager on political/conflict phrasing.
- [ ] **Bug: Speedometer shows wrong value** — 2 persons staking, 2 vs 100, shows 50% instead of the correct ratio (~2%).

---

## Upgrades (evaluate when ready)

- [ ] **Prisma 7** — major version available (5.22 → 7.x); review migration guide before upgrading.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
