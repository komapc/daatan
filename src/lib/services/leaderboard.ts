import { prisma } from '@/lib/prisma'

type SortBy = 'rs' | 'accuracy' | 'totalCorrect' | 'cuCommitted' | 'brierScore' | 'roi' | 'truthScore'

export const getLeaderboard = async (limit: number, sortBy: SortBy) => {
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

  const [cuSums, rsGainSums, resolvedCommitments, brierScoreSums] = await Promise.all([
    prisma.commitment.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _sum: { cuCommitted: true },
    }),
    prisma.commitment.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, rsChange: { gt: 0 } },
      _sum: { rsChange: true },
    }),
    prisma.commitment.findMany({
      where: {
        userId: { in: userIds },
        prediction: { status: { in: ['RESOLVED_CORRECT', 'RESOLVED_WRONG'] } },
        rsChange: { not: null },
      },
      select: { userId: true, rsChange: true },
    }),
    prisma.commitment.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, brierScore: { not: null } },
      _avg: { brierScore: true },
      _count: { brierScore: true },
    }),
  ])

  const cuByUser = new Map(cuSums.map(s => [s.userId, s._sum.cuCommitted ?? 0]))
  const rsGainByUser = new Map(rsGainSums.map(s => [s.userId, s._sum.rsChange ?? 0]))

  const resolvedByUser = new Map<string, { total: number; correct: number }>()
  for (const c of resolvedCommitments) {
    const entry = resolvedByUser.get(c.userId) ?? { total: 0, correct: 0 }
    entry.total++
    if ((c.rsChange ?? 0) > 0) entry.correct++
    resolvedByUser.set(c.userId, entry)
  }

  const brierByUser = new Map(brierScoreSums.map(s => [s.userId, {
    avg: s._avg.brierScore,
    count: s._count.brierScore,
  }]))

  const leaderboard = users.map(user => {
    const resolved = resolvedByUser.get(user.id) ?? { total: 0, correct: 0 }
    const accuracy = resolved.total > 0 ? Math.round((resolved.correct / resolved.total) * 100) : null
    const brier = brierByUser.get(user.id)
    const avgBrierScore = (brier && brier.count > 0 && brier.avg != null)
      ? Math.round(brier.avg * 1000) / 1000
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
      avgBrierScore,
      brierCount: brier?.count ?? 0,
      roi: null as number | null,
      truthScore: null as number | null,
    }
  })

  const sortFns: Record<SortBy, (a: typeof leaderboard[0], b: typeof leaderboard[0]) => number> = {
    rs: (a, b) => b.rs - a.rs,
    accuracy: (a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1),
    totalCorrect: (a, b) => b.totalCorrect - a.totalCorrect,
    cuCommitted: (a, b) => b.totalCuCommitted - a.totalCuCommitted,
    brierScore: (a, b) => {
      if (a.avgBrierScore == null && b.avgBrierScore == null) return 0
      if (a.avgBrierScore == null) return 1
      if (b.avgBrierScore == null) return -1
      return a.avgBrierScore - b.avgBrierScore
    },
    roi: (a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity),
    truthScore: (a, b) => (b.truthScore ?? -Infinity) - (a.truthScore ?? -Infinity),
  }

  leaderboard.sort(sortFns[sortBy] ?? sortFns.rs)
  return leaderboard.slice(0, limit)
}

export const getTopReputation = async (limit: number) => {
  return prisma.user.findMany({
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
    orderBy: { rs: 'desc' },
    take: limit,
  })
}
