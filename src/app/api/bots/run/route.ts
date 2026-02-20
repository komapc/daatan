import { NextRequest, NextResponse } from 'next/server'
import { runDueBots } from '@/lib/services/bot-runner'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/bots/run')

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes — RSS + LLM calls can be slow

/**
 * POST /api/bots/run
 * Triggered by GitHub Actions on a schedule (every 5 minutes).
 * Protected by a shared secret in the x-bot-runner-secret header.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-bot-runner-secret')

  if (!process.env.BOT_RUNNER_SECRET || secret !== process.env.BOT_RUNNER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  log.info('Bot runner triggered')

  try {
    const summaries = await runDueBots(false)
    return NextResponse.json({ ok: true, summaries })
  } catch (err) {
    log.error({ err }, 'Bot runner failed')
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
