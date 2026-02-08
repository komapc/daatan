import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    
    const { limit } = querySchema.parse({
      limit: searchParams.get('limit') ?? undefined,
    })

    const topUsers = await prisma.user.findMany({
      where: {
        isPublic: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        rs: true,
        cuAvailable: true,
        _count: {
          select: {
            predictions: true,
            commitments: true,
          },
        },
      },
      orderBy: {
        rs: 'desc',
      },
      take: limit,
    })

    return NextResponse.json({ users: topUsers })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid limit parameter (must be 1-100)' },
        { status: 400 }
      )
    }
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
