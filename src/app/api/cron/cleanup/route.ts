import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { cleanupOldNotifications } from '@/lib/services/notification'
import { createLogger } from '@/lib/logger'
import { env } from '@/env'

const log = createLogger('cron-cleanup')

function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/**
 * GET /api/cron/cleanup
 * Deletes notifications older than 90 days.
 * Protected by x-cron-secret header (same secret as BOT_RUNNER_SECRET).
 *
 * EC2 crontab (run daily at 03:00):
 *   0 3 * * * curl -sf -H "x-cron-secret: $BOT_RUNNER_SECRET" https://daatan.com/api/cron/cleanup
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  const expected = env.BOT_RUNNER_SECRET

  if (!expected || !secret || !secretsMatch(secret, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const deleted = await cleanupOldNotifications(90)
    log.info({ deleted }, 'Cron cleanup completed')
    return NextResponse.json({ ok: true, deleted })
  } catch (err) {
    log.error({ err }, 'Cron cleanup failed')
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
