import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveForecastSchema } from '@/lib/validations/forecast'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Lazy import Prisma
const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

type RouteParams = {
  params: { id: string }
}

// Calculate Brier score for a vote
const calculateBrierScore = (confidence: number, isCorrect: boolean): number => {
  const forecast = confidence / 100
  const outcome = isCorrect ? 1 : 0
  return Math.pow(forecast - outcome, 2)
}

// POST /api/forecasts/[id]/resolve - Resolve a forecast (admin only)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Admin or moderator
    if (!session.user.isAdmin && !session.user.isModerator) {
      return NextResponse.json(
        { error: 'Only admins or moderators can resolve forecasts' },
        { status: 403 }
      )
    }

    const forecast = await prisma.forecast.findUnique({
      where: { id: params.id },
      include: {
        options: true,
        votes: true,
      },
    })

    if (!forecast) {
      return NextResponse.json(
        { error: 'Forecast not found' },
        { status: 404 }
      )
    }

    // Can only resolve active or pending_resolution forecasts
    if (forecast.status !== 'ACTIVE' && forecast.status !== 'PENDING_RESOLUTION') {
      return NextResponse.json(
        { error: 'Can only resolve active or pending forecasts' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const data = resolveForecastSchema.parse(body)

    // Validate correct option belongs to this forecast
    const correctOption = forecast.options.find((opt: { id: string }) => opt.id === data.correctOptionId)
    if (!correctOption) {
      return NextResponse.json(
        { error: 'Invalid option for this forecast' },
        { status: 400 }
      )
    }

    // Start transaction
    await prisma.$transaction(async (tx) => {
      // 1. Mark forecast as resolved
      await tx.forecast.update({
        where: { id: params.id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedById: session.user.id,
          resolutionNote: data.resolutionNote,
        },
      })

      // 2. Mark options as correct/incorrect
      await tx.forecastOption.updateMany({
        where: {
          forecastId: params.id,
          id: data.correctOptionId,
        },
        data: { isCorrect: true },
      })

      await tx.forecastOption.updateMany({
        where: {
          forecastId: params.id,
          id: { not: data.correctOptionId },
        },
        data: { isCorrect: false },
      })

      // 3. Calculate Brier scores for all votes
      for (const vote of forecast.votes) {
        const isCorrect = vote.optionId === data.correctOptionId
        const brierScore = calculateBrierScore(vote.confidence, isCorrect)

        await tx.vote.update({
          where: { id: vote.id },
          data: { brierScore },
        })
      }

      // 4. Update user Brier scores
      const voterIds = [...new Set(forecast.votes.map((v: { userId: string }) => v.userId))]
      
      for (const voterId of voterIds) {
        const userVotes = await tx.vote.findMany({
          where: {
            userId: voterId,
            brierScore: { not: null },
          },
          select: { brierScore: true },
        })

        if (userVotes.length > 0) {
          const avgBrier = userVotes.reduce((sum, v) => sum + (v.brierScore ?? 0), 0) / userVotes.length
          
          await tx.user.update({
            where: { id: voterId },
            data: { brierScore: avgBrier },
          })
        }
      }
    })

    // Fetch the updated forecast
    const updatedForecast = await prisma.forecast.findUnique({
      where: { id: params.id },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        votes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true,
                brierScore: true,
              },
            },
            option: {
              select: {
                id: true,
                text: true,
                isCorrect: true,
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(updatedForecast)
  } catch (error) {
    console.error('Error resolving forecast:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to resolve forecast' },
      { status: 500 }
    )
  }
}
