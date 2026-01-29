import { NextResponse, NextRequest } from 'next/server'
import { VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  // Read env vars at runtime, not build time
  const gitCommit = process.env.GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown'
  const commitShort = gitCommit.slice(0, 7)
  const timestamp = new Date().toISOString()
  
  // Access request to ensure dynamic rendering
  const url = request.url
  
  console.log(`[${timestamp}] GET /api/health called - version: ${VERSION}, commit: ${commitShort}`)
  return NextResponse.json(
    { 
      status: 'ok',
      version: VERSION,
      commit: commitShort,
      timestamp: timestamp,
    },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      }
    }
  )
}

