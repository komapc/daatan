import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  // Read env vars at runtime
  const gitCommit = process.env.GIT_COMMIT || 'unknown'
  const commitShort = gitCommit.substring(0, 7)
  const timestamp = new Date().toISOString()

  return NextResponse.json({
    status: 'ok',
    version: VERSION,
    commit: commitShort,
    timestamp: timestamp,
  })
}
