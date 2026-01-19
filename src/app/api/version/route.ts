import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'

/**
 * GET /api/version
 * Returns the current version and environment info
 */
export async function GET() {
  // Use version from shared constant (matches package.json)
  const version = VERSION
  
  // Get git info if available (set via build args or env)
  const gitCommit = process.env.GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || null
  const gitBranch = process.env.GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || null
  
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
    node: process.version,
  })
}

