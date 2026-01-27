import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Git commit hash is set at build time via env var
const GIT_COMMIT = process.env.GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown'

export async function GET() {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] GET /api/health called - version: ${VERSION}, commit: ${GIT_COMMIT.slice(0, 7)}`)
  return NextResponse.json(
    { 
      status: 'ok',
      version: VERSION,
      commit: GIT_COMMIT.slice(0, 7),
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

