import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  // Force dynamic by reading headers (prevents static optimization)
  headers()
  
  // Read env vars at runtime, not build time
  const gitCommit = process.env.GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown'
  const commitShort = gitCommit.slice(0, 7)
  const timestamp = new Date().toISOString()
  
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
        'Cache-Control': 'no-store, max-age=0',
      }
    }
  )
}

