import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  return new NextResponse('google-site-verification: googled1d667f41fecd0d0.html', {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}
