import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { env } from '@/env'
import { getOracleSearchHealth, SEARCH_LOW_CREDITS_THRESHOLD } from '@/lib/services/oracleSearch'
import { notifySearchCreditsLow, notifyAllSearchProvidersFailed } from '@/lib/services/telegram'
import { secretsMatch } from '@/lib/cron-auth'

const log = createLogger('cron-search-health')

/**
 * GET /api/cron/search-health
 * Polls oracle /search/health and fires Telegram alerts for exhausted or
 * low-credit providers. Protected by x-cron-secret header.
 *
 * GitHub Actions: .github/workflows/search-health.yml (hourly)
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  const expected = env.BOT_RUNNER_SECRET

  if (!expected || !secret || !secretsMatch(secret, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const health = await getOracleSearchHealth()

  if (!health) {
    log.warn('Oracle search health unavailable — skipping notifications')
    return NextResponse.json({ ok: true, skipped: true, reason: 'oracle_not_configured' })
  }

  log.info({ overall: health.overall, usable_count: health.usable_count }, 'Oracle search health check')

  const alerts: string[] = []

  for (const [name, provider] of Object.entries(health.providers)) {
    if (!provider.configured) continue

    if (provider.exhausted) {
      notifySearchCreditsLow(name, 0)
      alerts.push(`${name}: exhausted`)
      continue
    }

    if (typeof provider.credits === 'number' && provider.credits < SEARCH_LOW_CREDITS_THRESHOLD) {
      notifySearchCreditsLow(name, provider.credits)
      alerts.push(`${name}: ${provider.credits} credits remaining`)
    }
  }

  if (health.overall === 'unhealthy' || health.usable_count === 0) {
    notifyAllSearchProvidersFailed()
    alerts.push('all providers failed')
  }

  log.info({ alerts, overall: health.overall }, 'Search health cron complete')

  return NextResponse.json({
    ok: true,
    overall: health.overall,
    usable_count: health.usable_count,
    alerts,
  })
}
