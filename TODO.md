# TODO.md — Task Queue

*Last updated: March 21, 2026 · v1.7.112*

---

## Open Tasks

### Reliability & Infrastructure
- ⏳ **Monitoring: Verify backup retention policies** — 30 days prod, 14 days staging

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
