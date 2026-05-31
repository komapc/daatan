import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

const RECENT_LIMIT = 50
const WINDOW_DAYS = 30

export const GET = withAuth(async () => {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [summary, recent] = await Promise.all([
    prisma.oracleCallLog.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _avg: { durationMs: true },
      _max: { createdAt: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.oracleCallLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
      select: {
        id: true,
        provider: true,
        providerChain: true,
        query: true,
        resultCount: true,
        durationMs: true,
        createdAt: true,
      },
    }),
  ])

  return NextResponse.json({
    windowDays: WINDOW_DAYS,
    summary: summary.map(row => ({
      provider: row.provider,
      callCount: row._count.id,
      avgDurationMs: row._avg.durationMs != null ? Math.round(row._avg.durationMs) : null,
      lastSeenAt: row._max.createdAt,
    })),
    recent,
  })
}, { roles: ['ADMIN'] })
