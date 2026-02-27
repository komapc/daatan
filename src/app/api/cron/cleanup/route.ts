import { NextRequest, NextResponse } from 'next/server'
import { cleanupOldNotifications } from '@/lib/services/notification'
import { createLogger } from '@/lib/logger'

const log = createLogger('cron-cleanup')

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

  if (!process.env.BOT_RUNNER_SECRET || secret !== process.env.BOT_RUNNER_SECRET) {
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
