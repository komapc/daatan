import { NextRequest, NextResponse } from 'next/server'

const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

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
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
