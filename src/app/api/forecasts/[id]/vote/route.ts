import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createVoteSchema } from '@/lib/validations/forecast'

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

// POST /api/forecasts/[id]/vote - Vote on a forecast
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

    const forecast = await prisma.forecast.findUnique({
      where: { id: params.id },
      include: {
        options: true,
      },
    })

    if (!forecast) {
      return NextResponse.json(
        { error: 'Forecast not found' },
        { status: 404 }
      )
    }

    // Can only vote on active forecasts
    if (forecast.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Can only vote on active forecasts' },
        { status: 400 }
      )
    }

    // Can't vote on own forecast
    if (forecast.creatorId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot vote on your own forecast' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const data = createVoteSchema.parse(body)

    // Validate option belongs to this forecast
    const optionExists = forecast.options.some((opt: { id: string }) => opt.id === data.optionId)
    if (!optionExists) {
      return NextResponse.json(
        { error: 'Invalid option for this forecast' },
        { status: 400 }
      )
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
    console.error('Error voting:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to vote' },
      { status: 500 }
    )
  }
}

// DELETE /api/forecasts/[id]/vote - Remove vote
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const forecast = await prisma.forecast.findUnique({
      where: { id: params.id },
      select: { status: true },
    })

    if (!forecast) {
      return NextResponse.json(
        { error: 'Forecast not found' },
        { status: 404 }
      )
    }

    // Can only remove vote from active forecasts
    if (forecast.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Cannot change vote on non-active forecasts' },
        { status: 400 }
      )
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
    console.error('Error removing vote:', error)
    return NextResponse.json(
      { error: 'Failed to remove vote' },
      { status: 500 }
    )
  }
}
