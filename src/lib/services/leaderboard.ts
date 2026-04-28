import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

type SortBy =
  | 'rs'
  | 'accuracy'
  | 'totalCorrect'
  | 'cuCommitted'
  | 'brierScore'
  | 'roi'
  | 'truthScore'
  | 'glicko'
  | 'peerScore'
  | 'aiScore'
  | 'elo'

export const getLeaderboard = async (limit: number, sortBy: SortBy, tagSlug?: string) => {
  const users = await prisma.user.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      rs: true,
      cuAvailable: true,
      mu: true,
      sigma: true,
      eloRating: true,
      totalPredictions: true,
      correctPredictions: true,
      _count: { select: { predictions: true, commitments: true } },
    },
  })

  const userIds = users.map(u => u.id)

  const tagFilter: Prisma.CommitmentWhereInput =
    tagSlug ? { prediction: { tags: { some: { slug: tagSlug } } } } : {}

  const [
    cuSums,
    rsGainSums,
    resolvedCommitments,
    brierScoreSums,
    peerScoreSums,
    aiScoreSums,
    rsChangeSums,
  ] = await Promise.all([
    prisma.commitment.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, ...tagFilter },
      _sum: { cuCommitted: true },
    }),
    prisma.commitment.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, rsChange: { gt: 0 }, ...tagFilter },
      _sum: { rsChange: true },
    }),
    prisma.commitment.findMany({
      where: {
        userId: { in: userIds },
        prediction: {
          status: { in: ['RESOLVED_CORRECT', 'RESOLVED_WRONG'] },
          ...(tagSlug ? { tags: { some: { slug: tagSlug } } } : {}),
        },
        rsChange: { not: null },
      },
      select: { userId: true, rsChange: true },
    }),
    prisma.commitment.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, brierScore: { not: null }, ...tagFilter },
      _avg: { brierScore: true },
      _count: { brierScore: true },
    }),
    prisma.commitment.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, peerScore: { not: null }, ...tagFilter },
      _sum: { peerScore: true },
      _count: { peerScore: true },
    }),
    prisma.commitment.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, aiScore: { not: null }, ...tagFilter },
      _sum: { aiScore: true },
    }),
    // Net RS change (all resolved, positive + negative) — used for ROI metric
    prisma.commitment.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, rsChange: { not: null }, ...tagFilter },
      _sum: { rsChange: true },
      _count: { rsChange: true },
    }),
  ])

  const cuByUser = new Map(cuSums.map(s => [s.userId, s._sum.cuCommitted ?? 0]))
  const rsGainByUser = new Map(rsGainSums.map(s => [s.userId, s._sum.rsChange ?? 0]))
  const peerScoreByUser = new Map(peerScoreSums.map(s => [s.userId, {
    sum: s._sum.peerScore ?? null,
    count: s._count.peerScore,
  }]))
  const aiScoreByUser = new Map(aiScoreSums.map(s => [s.userId, s._sum.aiScore ?? null]))
  const rsChangeByUser = new Map(rsChangeSums.map(s => [s.userId, {
    sum: s._sum.rsChange ?? 0,
    count: s._count.rsChange,
  }]))

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

    // μ - 3σ: lower bound of skill estimate; prevents one-hit wonders from topping the board
    const glickoRank = user.mu - 3 * user.sigma

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      rs: user.rs,
      cuAvailable: user.cuAvailable,
      mu: user.mu,
      sigma: user.sigma,
      glickoRank,
      eloRating: user.eloRating,
      totalPredictions: user.totalPredictions,
      correctPredictions: user.correctPredictions,
      totalCommitments: user._count.commitments,
      totalResolved: resolved.total,
      totalCorrect: resolved.correct,
      accuracy,
      totalCuCommitted: cuByUser.get(user.id) ?? 0,
      totalRsGained: Math.round((rsGainByUser.get(user.id) ?? 0) * 100) / 100,
      avgBrierScore,
      brierCount: brier?.count ?? 0,
      peerScoreSum: peerScoreByUser.get(user.id)?.sum ?? null,
      aiScoreSum: aiScoreByUser.get(user.id) ?? null,
      // ROI: average net RS change per resolved prediction (positive = net gain)
      roi: (() => {
        const rs = rsChangeByUser.get(user.id)
        if (!rs || rs.count < 3) return null
        return Math.round((rs.sum / rs.count) * 100) / 100
      })(),
      // truthScore: average peer score per prediction (how consistently you beat the crowd)
      truthScore: (() => {
        const ps = peerScoreByUser.get(user.id)
        if (!ps || ps.count < 3 || ps.sum === null) return null
        return Math.round((ps.sum / ps.count) * 10000) / 10000
      })(),
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
    glicko: (a, b) => b.glickoRank - a.glickoRank,
    peerScore: (a, b) => (b.peerScoreSum ?? -Infinity) - (a.peerScoreSum ?? -Infinity),
    aiScore: (a, b) => (b.aiScoreSum ?? -Infinity) - (a.aiScoreSum ?? -Infinity),
    elo: (a, b) => b.eloRating - a.eloRating,
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
