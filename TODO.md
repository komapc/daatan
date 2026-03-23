# TODO.md — Task Queue

*Last updated: March 23, 2026 · v1.7.131*

---

## Open Tasks

### Reliability & Infrastructure
- ✅ **Monitoring: Verify backup retention policies** — confirmed: prod 30 days, staging 14 days, both enabled on S3 lifecycle rules
- ✅ **Phase 4 IaC: Split docker-compose and nginx configs per environment** — `docker-compose.staging.yml` and `infra/nginx/nginx-prod-ssl.conf` created; deploy jobs send per-environment files; `blue-green-deploy.sh` uses `$COMPOSE_FILE`; `check-env-parity.sh` updated for split files.
- ✅ **Terraform: Remove SSH port from security group** — port 22 ingress rule removed; `allowed_ssh_cidr` variable removed; all access via SSM.
- ✅ **Telegram bot token refresh** — updated to @DaatanClawBot token in GitHub Actions secret + both Secrets Manager entries; containers restarted.

### Features & UX
- ✅ **Bug: Edit button changes input field background to white** — fixed
- ✅ **Bug: Prediction filter too strict** — fixed
- ✅ **Bug: Speedometer shows wrong value** — fixed

---

## Upgrades (evaluate when ready)

- [ ] **Prisma 7** — major version available (5.22 → 7.x); review migration guide before upgrading.
- [ ] **Drizzle ORM** — lighter runtime and SQL-first API vs Prisma; evaluate when Prisma becomes a bottleneck.

---

*Agents: Work through open tasks in priority order. Notify komap via Telegram when ready for review.*
