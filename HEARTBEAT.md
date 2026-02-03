# HEARTBEAT.md - Proactive Checks

## Every 4 Hours
- [ ] QA: Check https://staging.daatan.com/api/health is reachable
- [ ] QA: Check https://daatan.com/api/health is reachable
- [ ] DevOps: Check local disk space (warn if <10GB free)

## Daily (09:00 Israel time)
- [ ] Developer: Summarize yesterday's commits (3 sentences max)
- [ ] Developer: List any pending PRs or stale branches
- [ ] DevOps: Run `npm audit` and report critical vulnerabilities

## Weekly (Sunday 10:00)
- [ ] DevOps: Check SSL certificate expiry for daatan.com
- [ ] QA: Review error logs from past week

## Rules
- During quiet hours (00:00-08:00): queue notifications, don't send
- Only ping Telegram for: failures, security issues, items needing action
- Use HEARTBEAT_OK response if nothing needs attention
- Track check timestamps in memory/heartbeat-state.json
