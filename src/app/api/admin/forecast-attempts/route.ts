import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/forecast-attempts
 *
 * Returns aggregated analytics for Express forecast creation attempts:
 *   - overall totals by outcome
 *   - daily success rate for the last 30 days
 *   - top moderation rejection reasons (details.moderationReason)
 *   - top users by attempt count (last 30 days)
 */
export const GET = withAuth(async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [totals, recent, moderationReasons, topUsers] = await Promise.all([
    // Overall totals by outcome (all time)
    prisma.forecastCreationAttempt.groupBy({
      by: ['outcome'],
      _count: { _all: true },
      orderBy: { _count: { outcome: 'desc' } },
    }),

    // Daily breakdown for the last 30 days
    prisma.$queryRaw<{ date: string; outcome: string; count: bigint }[]>`
      SELECT
        DATE("createdAt")::text AS date,
        outcome::text,
        COUNT(*) AS count
      FROM forecast_creation_attempts
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt"), outcome
      ORDER BY date DESC, count DESC
    `,

    // Top moderation reasons from the MODERATED attempts
    prisma.$queryRaw<{ reason: string; count: bigint }[]>`
      SELECT
        details->>'moderationReason' AS reason,
        COUNT(*) AS count
      FROM forecast_creation_attempts
      WHERE outcome = 'MODERATED' AND details->>'moderationReason' IS NOT NULL
      GROUP BY reason
      ORDER BY count DESC
      LIMIT 20
    `,

    // Top users by attempt count (last 30 days)
    prisma.$queryRaw<{ userId: string; name: string | null; email: string; attempts: bigint; successes: bigint }[]>`
      SELECT
        a."userId",
        u.name,
        u.email,
        COUNT(*) AS attempts,
        COUNT(*) FILTER (WHERE a.outcome = 'SUCCESS') AS successes
      FROM forecast_creation_attempts a
      JOIN users u ON u.id = a."userId"
      WHERE a."createdAt" >= ${thirtyDaysAgo}
      GROUP BY a."userId", u.name, u.email
      ORDER BY attempts DESC
      LIMIT 20
    `,
  ])

  const total = totals.reduce((sum, row) => sum + row._count._all, 0)
  const successCount = totals.find(r => r.outcome === 'SUCCESS')?._count._all ?? 0
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0

  // Reshape daily data into {date: {outcome: count}} map
  const dailyMap: Record<string, Record<string, number>> = {}
  for (const row of recent) {
    dailyMap[row.date] ??= {}
    dailyMap[row.date][row.outcome] = Number(row.count)
  }
  const daily = Object.entries(dailyMap)
    .map(([date, outcomes]) => ({ date, ...outcomes }))
    .sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json({
    summary: {
      total,
      successRate,
      byOutcome: Object.fromEntries(totals.map(r => [r.outcome, r._count._all])),
    },
    daily,
    moderationReasons: moderationReasons.map(r => ({ reason: r.reason, count: Number(r.count) })),
    topUsers: topUsers.map(r => ({
      userId: r.userId,
      name: r.name,
      email: r.email,
      attempts: Number(r.attempts),
      successes: Number(r.successes),
      successRate: Number(r.attempts) > 0 ? Math.round((Number(r.successes) / Number(r.attempts)) * 100) : 0,
    })),
  })
}, { roles: ['ADMIN'] })
