import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  console.log('GET /api/version called - returning:', VERSION)
  return NextResponse.json(
    { 
      status: 'version-check',
      version: VERSION
    },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    }
  )
}

