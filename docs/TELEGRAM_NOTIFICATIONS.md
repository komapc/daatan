# Telegram Notifications

All notifications go to the channel configured by `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` secrets. Messages are prefixed with `[prod]` or `[staging]` based on `APP_ENV`.

---

## CI/CD Notifications (GitHub Actions)

Sent by `deploy.yml`, `backup.yml`, `rollback.yml`.

| Event | Icon | Message |
|---|---|---|
| Staging deploy success | ✅ | `[staging] Deployment successful` — version, PR number+title, PR link |
| Staging deploy failure | ❌ | `[staging] Deployment failed` — version, PR number+title, PR link + logs link |
| Production deploy success | ✅ | `[prod] Deployment successful` — version, PR number+title, PR link |
| Production deploy failure | ❌ | `[prod] Deployment failed` — version, PR number+title, PR link + logs link |
| DB backup failure | 🚨 | `DB Backup FAILED` — timestamp |
| Rollback success | 🔄 | `[env] Rollback to vX complete` — reason, triggered-by |
| Rollback failure | ❌ | `[env] Rollback to vX FAILED. Manual intervention required` — reason, logs link |

---

## Watchdog Notifications (`watchdog.yml` — every 5 min)

### HTTP health checks

Sent directly by `watchdog.yml` from the **GitHub Actions runner**. Both `production` and `staging` are checked.

| Event | Icon | Message |
|---|---|---|
| Any health check fails | 🚨 | `[env] Health check FAILED` — list of failing checks, health endpoint link |
| Staging version newer than prod | ⚠️ | `[prod] Version drift: prod is running vX but staging has vY — consider deploying` |

**Health checks performed:**
- `Health (app+db)` — `/api/health` → `status: "ok"`
- `Health DB flag` — `/api/health` → `db: true`
- `Homepage` — HTTP 200
- `Forecast feed` — `/forecasts` HTTP 200
- `Leaderboard` — `/leaderboard` HTTP 200
- `About/login` — `/auth/signin` HTTP 200

Any unexpected redirect also counts as a failure (guards against redirect loops).

**Version drift dedup:** at most one alert per production version. Once notified that prod=vX is behind, no further alerts fire until prod itself advances to a new version.

### Disk / CPU / Memory checks (EC2)

Sent by shell scripts **executing on the EC2 server** via SSM from `watchdog.yml`'s `disk-watchdog` job. Alerts use the server's `TELEGRAM_BOT_TOKEN` from `.env` — independent of GitHub Actions credentials.

| Script | Event | Icon | Threshold |
|---|---|---|---|
| `scripts/check-disk-space.sh` | Root partition usage high | 💾 | > 90% |
| `scripts/check-system-health.sh` | Memory usage high | 🧠 | > 90% |
| `scripts/check-system-health.sh` | CPU load high | 🔥 | > cores × 2 (1-min avg) |

---

## Heartbeat (`heartbeat.yml` — daily 09:00 UTC)

Sent by the **EC2 app process** via `GET /api/cron/heartbeat` (triggered by `heartbeat.yml`). Because the Telegram message originates from the server — not from GitHub Actions — a silent heartbeat means the server itself has a problem, not just that GitHub Actions is down.

| Event | Icon | Message |
|---|---|---|
| Server alive | ✅ | `Server heartbeat — vX.Y.Z is alive. Sent from the server (EC2 app process), not GitHub Actions.` |
| Backup restore failed | 🚨 | `Backup Verification FAILED — reason — Manual investigation required` (sent from `scripts/verify-backup.sh` on EC2) |

---

## Application Notifications (`src/lib/services/telegram.ts`)

Sent by API routes and services on business and operational events.

### Business Events

| Event | Icon | Triggered by |
|---|---|---|
| New forecast published | 📢 | `POST /api/forecasts/[id]/publish` |
| New commitment made | 🎯 | `src/lib/services/commitment.ts` → `createCommitment()` |
| New comment posted | 💬 | `POST /api/comments` |
| Forecast resolved | ⚖️ | `POST /api/forecasts/[id]/resolve` |
| Bot forecast approved | ✅ | `POST /api/forecasts/[id]/approve` |
| Bot forecast rejected | ❌ | `POST /api/forecasts/[id]/reject` |
| New user registered | 🆕 | `POST /api/auth/signup` (credentials) and OAuth sign-in handler |

### Operational Alerts

| Event | Icon | Rate-limited | Triggered by |
|---|---|---|---|
| Server error | 🚨 | 5 min per `route:ErrorType` | `src/lib/api-middleware.ts` |
| Security event (403/401) | 🛡️ | 5 min per `pathname:status` | `src/lib/api-middleware.ts` |
| Dead link / 404 | 🔗 | 5 min per `pathname` | API routes on not-found |
| LLM provider error | 🤖 | 5 min per `provider` | `src/lib/llm/index.ts` |
| All search providers failed | ⚠️ | 5 min (global) | `src/lib/utils/webSearch.ts` |
| Oracle search unavailable | ⚠️ | 5 min (global) | `src/lib/services/oracleSearch.ts` |
| Search credits low | ⚠️ | 5 min per provider | `src/lib/utils/webSearch.ts` |

**Rate limiting:** Error notifications use a 5-minute in-memory cooldown. Cooldown resets on process restart.

**Dev suppression:** All application notifications are suppressed when `APP_ENV=development`.

---

## Configuration

| Secret | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather (format: `123456:ABC-...`) |
| `TELEGRAM_CHAT_ID` | Target channel/group ID (negative number for groups) |
| `CRON_SECRET` | Shared secret for `/api/cron/heartbeat` — same value as `BOT_RUNNER_SECRET` in `.env` |

`TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are stored in both GitHub Actions secrets (for CI/CD alerts) and AWS Secrets Manager (for runtime app alerts). The EC2 instance reads them from `.env` at runtime.
