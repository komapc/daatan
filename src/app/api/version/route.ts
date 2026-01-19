import { NextResponse } from 'next/server'
import { VERSION } from '../../../lib/version'

export const dynamic = 'force-dynamic'

/**
 * GET /api/version
 * Returns the current version and environment info
 */
export async function GET() {
  // Use version from shared constant
  const version = VERSION
  
  // Get git info if available
  const gitCommit = process.env.GIT_COMMIT || null
  const gitBranch = process.env.GIT_BRANCH || null
  
  // Environment
  const environment = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'unknown'
  
  return NextResponse.json({
    version,
    environment,
    git: {
      commit: gitCommit,
      branch: gitBranch,
    },
    timestamp: new Date().toISOString(),
  })
}

