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

    // Get all public users with commitment data
    const users = await prisma.user.findMany({
      where: { isPublic: true },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        rs: true,
        cuAvailable: true,
        commitments: {
          select: {
            cuCommitted: true,
            cuReturned: true,
            rsChange: true,
            prediction: {
              select: { status: true },
            },
          },
        },
        _count: {
          select: {
            predictions: true,
            commitments: true,
          },
        },
      },
    })

    // Compute stats for each user
    const leaderboard = users.map((user) => {
      const resolved = user.commitments.filter(c =>
        c.prediction.status === 'RESOLVED_CORRECT' || c.prediction.status === 'RESOLVED_WRONG'
      )
      const correct = resolved.filter(c => (c.cuReturned ?? 0) > c.cuCommitted)
      const totalCuCommitted = user.commitments.reduce((s, c) => s + c.cuCommitted, 0)
      const totalRsGained = user.commitments.reduce((s, c) => s + Math.max(0, c.rsChange ?? 0), 0)
      const accuracy = resolved.length > 0
        ? Math.round((correct.length / resolved.length) * 100)
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
        totalCorrect: correct.length,
        totalResolved: resolved.length,
        accuracy,
        totalCuCommitted,
        totalRsGained: Math.round(totalRsGained * 100) / 100,
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
