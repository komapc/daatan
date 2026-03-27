# Telegram Notifications

All notifications go to the channel configured by `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` secrets. Messages are prefixed with `[prod]` or `[staging]` based on `APP_ENV`.

---

## CI/CD Notifications (GitHub Actions)

Sent by `deploy.yml`, `backup.yml`, `rollback.yml`.

| Event | Icon | Message |
|---|---|---|
| Staging deploy success | ✅ | `[staging] Deployment successful` — version, branch, commit link |
| Staging deploy failure | ❌ | `[staging] Deployment failed` — version, branch, logs link |
| Production deploy success | ✅ | `[prod] Deployment successful` — version, tag, release link |
| Production deploy failure | ❌ | `[prod] Deployment failed` — version, tag, logs link |
| DB backup failure | 🚨 | `DB Backup FAILED` — timestamp |
| Rollback success | 🔄 | `[env] Rollback to vX complete` — reason, triggered-by |
| Rollback failure | ❌ | `[env] Rollback to vX FAILED. Manual intervention required` — reason, logs link |

---

## Watchdog Notifications (every 5 min)

Sent by `watchdog.yml`. Runs against both `production` and `staging`.

| Event | Icon | Message |
|---|---|---|
| Any health check fails | 🚨 | `[env] Health check FAILED` — list of failing checks, health endpoint link |
| Staging version newer than prod | ⚠️ | `[prod] Version drift: prod is running vX but staging has vY — consider deploying to production` |

**Health checks performed:**
- `Health (app+db)` — `/api/health` → `status: "ok"`
- `Health DB flag` — `/api/health` → `db: true` (boolean)
- `Homepage` — HTTP 200
- `Forecast feed` — `/forecasts` HTTP 200
- `Leaderboard` — `/leaderboard` HTTP 200
- `About/login` — `/auth/signin` HTTP 200

Any unexpected redirect also counts as a failure (guards against redirect loops).

---

## Application Notifications (`src/lib/services/telegram.ts`)

Sent by API routes on business events.

| Event | Icon | Triggered by |
|---|---|---|
| New forecast published | 📢 | `POST /api/forecasts/[id]/publish` |
| New commitment made | 🎯 | `src/lib/services/commitment.ts` → `createCommitment()` |
| New comment posted | 💬 | `POST /api/comments` |
| Forecast resolved | ⚖️ | `POST /api/forecasts/[id]/resolve` |
| Bot forecast approved | ✅ | `POST /api/forecasts/[id]/approve` |
| Bot forecast rejected | ❌ | `POST /api/forecasts/[id]/reject` |
| Server error | 🚨 | `src/lib/api-middleware.ts` — rate-limited, max 1 per route per 5 min |
| All search providers failed | ⚠️ | `src/lib/utils/webSearch.ts` — rate-limited |
| Search credits low | ⚠️ | `src/lib/utils/webSearch.ts` — rate-limited per provider |

**Rate limiting:** Error notifications use a 5-minute in-memory cooldown keyed by `route:ErrorType` to avoid flooding. Cooldown resets on process restart.

**Dev suppression:** Application notifications are suppressed when `APP_ENV=development`.

---

## Configuration

| Secret | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather (format: `123456:ABC-...`) |
| `TELEGRAM_CHAT_ID` | Target channel/group ID (negative number for groups) |

Both are stored in GitHub Actions secrets and in AWS Secrets Manager for runtime use.
