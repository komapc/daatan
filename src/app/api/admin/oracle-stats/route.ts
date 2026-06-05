import { NextResponse } from 'next/server'
import { OracleCallType } from '@prisma/client'
import { withAuth } from '@/lib/api-middleware'
import { getOracleUsageStats } from '@/lib/services/oracleStats'

const VALID_CALL_TYPES = Object.values(OracleCallType) as string[]

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const raw = parseInt(searchParams.get('windowDays') || '30', 10)
  const windowDays = Math.min(30, Math.max(1, Number.isNaN(raw) ? 30 : raw))

  const source = searchParams.get('source') || undefined
  const callTypeParam = searchParams.get('callType') || undefined
  const callType = callTypeParam && VALID_CALL_TYPES.includes(callTypeParam)
    ? (callTypeParam as OracleCallType)
    : undefined

  const stats = await getOracleUsageStats(windowDays, { source, callType })
  return NextResponse.json(stats)
}, { roles: ['ADMIN'] })
