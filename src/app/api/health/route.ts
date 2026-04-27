import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'
import { checkDatabaseHealth } from '@/lib/services/health'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const gitCommit = process.env.GIT_COMMIT || 'unknown'
  const commitShort = gitCommit.substring(0, 7)
  const timestamp = new Date().toISOString()

  const db = await checkDatabaseHealth()
  const status = db ? 'ok' : 'degraded'

  return NextResponse.json(
    { status, version: VERSION, commit: commitShort, timestamp, env: process.env.APP_ENV ?? 'unknown', db },
    { status: db ? 200 : 503 }
  )
}
