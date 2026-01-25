import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  console.log('GET /api/health called - returning version:', VERSION)
  return NextResponse.json(
    { 
      status: 'ok',
      version: VERSION,
      timestamp: new Date().toISOString()
    },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    }
  )
}

