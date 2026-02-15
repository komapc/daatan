import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolveForecastSchema } from '@/lib/validations/forecast'
import { apiError, handleRouteError } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

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
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    // Admin or resolver
    if (session.user.role !== 'ADMIN' && session.user.role !== 'RESOLVER') {
      return apiError('Only admins or resolvers can resolve forecasts', 403)
    }

    const forecast = await prisma.forecast.findUnique({
      where: { id: params.id },
      include: {
        options: true,
        votes: true,
      },
    })

    if (!forecast) {
      return apiError('Forecast not found', 404)
    }

    // Can only resolve active or pending_resolution forecasts
    if (forecast.status !== 'ACTIVE' && forecast.status !== 'PENDING_RESOLUTION') {
      return apiError('Can only resolve active or pending forecasts', 400)
    }

    const body = await request.json()
    const data = resolveForecastSchema.parse(body)

    // Validate correct option belongs to this forecast
    const correctOption = forecast.options.find((opt: { id: string }) => opt.id === data.correctOptionId)
    if (!correctOption) {
      return apiError('Invalid option for this forecast', 400)
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
    return handleRouteError(error, 'Failed to resolve forecast')
  }
}
