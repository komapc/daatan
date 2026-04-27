import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api-error'
import { getLeaderboard } from '@/lib/services/leaderboard'

export const dynamic = 'force-dynamic'

type SortBy = 'rs' | 'accuracy' | 'totalCorrect' | 'cuCommitted' | 'brierScore' | 'roi' | 'truthScore' | 'glicko'

// GET /api/leaderboard - Enhanced leaderboard with multiple sort modes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const sortBy = (searchParams.get('sortBy') || 'rs') as SortBy
    const leaderboard = await getLeaderboard(limit, sortBy)
    return NextResponse.json({ leaderboard })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch leaderboard')
  }
}
