import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Hardcoded version - update manually for releases
const APP_VERSION = '0.1.16'

export async function GET() {
  // Read env vars at runtime
  const gitCommit = process.env.GIT_COMMIT || 'unknown'
  const commitShort = gitCommit.substring(0, 7)
  const timestamp = new Date().toISOString()

  return NextResponse.json({
    status: 'ok',
    version: APP_VERSION,
    commit: commitShort,
    timestamp: timestamp,
  })
}
