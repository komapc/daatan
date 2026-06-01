import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-middleware'
import { handleRouteError } from '@/lib/api-error'
import { env } from '@/env'

const schema = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  temperature: z.number().min(0).max(2).default(0.1),
})

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const payload = schema.parse(body)

    const oracleUrl = env.ORACLE_URL
    const oracleKey = env.ORACLE_API_KEY
    if (!oracleUrl || !oracleKey) return NextResponse.json({ error: 'Oracle not configured' }, { status: 503 })

    const res = await fetch(`${oracleUrl.replace(/\/$/, '')}/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': oracleKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    })

    const text = await res.text()
    try {
      return NextResponse.json(JSON.parse(text), { status: res.status })
    } catch {
      return NextResponse.json(
        { error: 'Oracle returned a non-JSON response' },
        { status: res.status >= 400 ? res.status : 502 },
      )
    }
  } catch (error) {
    return handleRouteError(error, 'llm proxy failed')
  }
}, { roles: ['ADMIN'] })
