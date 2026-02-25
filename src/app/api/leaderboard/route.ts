import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type SortBy = 'rs' | 'accuracy' | 'totalCorrect' | 'cuCommitted'

// GET /api/leaderboard - Enhanced leaderboard with multiple sort modes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const sortBy = (searchParams.get('sortBy') || 'rs') as SortBy

    // Fetch base user list first, then aggregate commitment stats in parallel
    const users = await prisma.user.findMany({
      where: { isPublic: true },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        rs: true,
        cuAvailable: true,
        _count: { select: { predictions: true, commitments: true } },
      },
    })

    const userIds = users.map(u => u.id)

    // Three targeted queries instead of loading all commitments into memory
    const [cuSums, rsGainSums, resolvedCommitments] = await Promise.all([
      // Total CU committed per user
      prisma.commitment.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _sum: { cuCommitted: true },
      }),
      // Total positive RS gained per user
      prisma.commitment.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, rsChange: { gt: 0 } },
        _sum: { rsChange: true },
      }),
      // Only resolved commitments (for accuracy calculation)
      prisma.commitment.findMany({
        where: {
          userId: { in: userIds },
          prediction: { status: { in: ['RESOLVED_CORRECT', 'RESOLVED_WRONG'] } },
        },
        select: { userId: true, cuCommitted: true, cuReturned: true },
      }),
    ])

    // Build lookup maps for O(1) access
    const cuByUser = new Map(cuSums.map(s => [s.userId, s._sum.cuCommitted ?? 0]))
    const rsGainByUser = new Map(rsGainSums.map(s => [s.userId, s._sum.rsChange ?? 0]))
    const resolvedByUser = new Map<string, { total: number; correct: number }>()
    for (const c of resolvedCommitments) {
      const entry = resolvedByUser.get(c.userId) ?? { total: 0, correct: 0 }
      entry.total++
      if ((c.cuReturned ?? 0) > c.cuCommitted) entry.correct++
      resolvedByUser.set(c.userId, entry)
    }

    // Compute stats for each user
    const leaderboard = users.map((user) => {
      const resolved = resolvedByUser.get(user.id) ?? { total: 0, correct: 0 }
      const accuracy = resolved.total > 0
        ? Math.round((resolved.correct / resolved.total) * 100)
        : null

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        image: user.image,
        rs: user.rs,
        cuAvailable: user.cuAvailable,
        totalCommitments: user._count.commitments,
        totalPredictions: user._count.predictions,
        totalCorrect: resolved.correct,
        totalResolved: resolved.total,
        accuracy,
        totalCuCommitted: cuByUser.get(user.id) ?? 0,
        totalRsGained: Math.round((rsGainByUser.get(user.id) ?? 0) * 100) / 100,
      }
    })

    // Sort by requested metric
    const sortFns: Record<SortBy, (a: typeof leaderboard[0], b: typeof leaderboard[0]) => number> = {
      rs: (a, b) => b.rs - a.rs,
      accuracy: (a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1),
      totalCorrect: (a, b) => b.totalCorrect - a.totalCorrect,
      cuCommitted: (a, b) => b.totalCuCommitted - a.totalCuCommitted,
    }

    leaderboard.sort(sortFns[sortBy] || sortFns.rs)

    return NextResponse.json({ leaderboard: leaderboard.slice(0, limit) })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch leaderboard')
  }
}
