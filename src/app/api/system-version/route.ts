import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { 
      status: 'version-check',
      version: '0.1.1'
    },
    { status: 200 }
  )
}

