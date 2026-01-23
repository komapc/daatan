import { NextResponse } from 'next/server'
import { VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { 
      status: 'version-check',
      version: VERSION
    },
    { status: 200 }
  )
}

