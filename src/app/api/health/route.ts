import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] GET /api/health called - returning version: ${VERSION}`)
  return NextResponse.json(
    { 
      status: 'ok',
      version: VERSION,
      timestamp: timestamp,
      debug: 'v2'
    },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    }
  )
}

