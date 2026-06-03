import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { getOracleUsageStats } from '@/lib/services/oracleStats'

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const raw = parseInt(searchParams.get('windowDays') || '30', 10)
  const windowDays = Math.min(30, Math.max(1, Number.isNaN(raw) ? 30 : raw))

  const stats = await getOracleUsageStats(windowDays)
  return NextResponse.json(stats)
}, { roles: ['ADMIN'] })
