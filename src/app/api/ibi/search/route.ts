import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-middleware'
import { handleRouteError } from '@/lib/api-error'
import { env } from '@/env'

const schema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(10),
  date_to: z.string().optional(),
})

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const payload = schema.parse(body)

    const oracleUrl = env.ORACLE_URL
    const oracleKey = env.ORACLE_API_KEY
    if (!oracleUrl || !oracleKey) return NextResponse.json({ error: 'Oracle not configured' }, { status: 503 })

    const res = await fetch(`${oracleUrl.replace(/\/$/, '')}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': oracleKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    return handleRouteError(error, 'search proxy failed')
  }
})
