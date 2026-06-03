import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-middleware'
import { handleRouteError } from '@/lib/api-error'
import { getOracleConfig, oracleFetch, logOracleCall } from '@/lib/services/oracleClient'

const schema = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
  temperature: z.number().min(0).max(2).default(0.1),
})

export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json()
    const payload = schema.parse(body)

    const cfg = getOracleConfig()
    if (!cfg) return NextResponse.json({ error: 'Oracle not configured' }, { status: 503 })

    const t0 = Date.now()
    const res = await oracleFetch(cfg, '/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 60_000,
    })
    void logOracleCall({
      callType: 'LLM', status: res.ok ? 'OK' : 'ERROR', meta: { source: 'ibi-llm', userId: user.id },
      durationMs: Date.now() - t0, httpStatus: res.status,
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
