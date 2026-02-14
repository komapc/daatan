import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createVoteSchema } from '@/lib/validations/forecast'
import { apiError, handleRouteError } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

type RouteParams = {
  params: { id: string }
}

// POST /api/forecasts/[id]/vote - Vote on a forecast
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const forecast = await prisma.forecast.findUnique({
      where: { id: params.id },
      include: {
        options: true,
      },
    })

    if (!forecast) {
      return apiError('Forecast not found', 404)
    }

    // Can only vote on active forecasts
    if (forecast.status !== 'ACTIVE') {
      return apiError('Can only vote on active forecasts', 400)
    }

    // Can't vote on own forecast
    if (forecast.creatorId === session.user.id) {
      return apiError('Cannot vote on your own forecast', 400)
    }

    const body = await request.json()
    const data = createVoteSchema.parse(body)

    // Validate option belongs to this forecast
    const optionExists = forecast.options.some((opt: { id: string }) => opt.id === data.optionId)
    if (!optionExists) {
      return apiError('Invalid option for this forecast', 400)
    }

    // Upsert vote (update if exists, create if not)
    const vote = await prisma.vote.upsert({
      where: {
        userId_forecastId: {
          userId: session.user.id,
          forecastId: params.id,
        },
      },
      update: {
        optionId: data.optionId,
        confidence: data.confidence,
      },
      create: {
        userId: session.user.id,
        forecastId: params.id,
        optionId: data.optionId,
        confidence: data.confidence,
      },
      include: {
        option: {
          select: {
            id: true,
            text: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(vote, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to vote')
  }
}

// DELETE /api/forecasts/[id]/vote - Remove vote
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const forecast = await prisma.forecast.findUnique({
      where: { id: params.id },
      select: { status: true },
    })

    if (!forecast) {
      return apiError('Forecast not found', 404)
    }

    // Can only remove vote from active forecasts
    if (forecast.status !== 'ACTIVE') {
      return apiError('Cannot change vote on non-active forecasts', 400)
    }

    await prisma.vote.delete({
      where: {
        userId_forecastId: {
          userId: session.user.id,
          forecastId: params.id,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to remove vote')
  }
}
