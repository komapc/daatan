import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-middleware'
import { handleRouteError } from '@/lib/api-error'
import { env } from '@/env'

const schema = z.object({ url: z.string().url() })

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { url } = schema.parse(body)

    const oracleUrl = env.ORACLE_URL
    if (!oracleUrl) return NextResponse.json({ error: 'Oracle not configured' }, { status: 503 })

    const res = await fetch(`${oracleUrl.replace(/\/$/, '')}/fetch-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(15_000),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    return handleRouteError(error, 'fetch-url proxy failed')
  }
}, { roles: ['ADMIN'] })
