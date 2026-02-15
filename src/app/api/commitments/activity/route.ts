import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/commitments/activity - Public real-time activity feed of recent commitments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const recentCommitments = await prisma.commitment.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            rs: true,
          },
        },
        prediction: {
          select: {
            id: true,
            slug: true,
            claimText: true,
            status: true,
            outcomeType: true,
          },
        },
        option: {
          select: {
            id: true,
            text: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ activity: recentCommitments })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch activity feed')
  }
}
