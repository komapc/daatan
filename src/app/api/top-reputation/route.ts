import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteError } from '@/lib/api-error'
import { getTopReputation } from '@/lib/services/leaderboard'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { limit } = querySchema.parse({ limit: searchParams.get('limit') ?? undefined })
    const users = await getTopReputation(limit)
    return NextResponse.json({ users })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch leaderboard')
  }
}
