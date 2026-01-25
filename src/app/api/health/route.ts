import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  console.log('GET /api/health called')
  return NextResponse.json(
    { 
      status: 'ok',
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

