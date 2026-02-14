import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateForecastSchema } from '@/lib/validations/forecast'
import { apiError, handleRouteError } from '@/lib/api-error'

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

// GET /api/forecasts/[id] - Get a single forecast
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const forecast = await prisma.forecast.findUnique({
      where: { id: params.id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            brierScore: true,
          },
        },
        options: {
          orderBy: { displayOrder: 'asc' },
          include: {
            _count: {
              select: { votes: true },
            },
          },
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
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { votes: true },
        },
      },
    })

    if (!forecast) {
      return apiError('Forecast not found', 404)
    }

    return NextResponse.json(forecast)
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch forecast')
  }
}

// PATCH /api/forecasts/[id] - Update a forecast
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const forecast = await prisma.forecast.findUnique({
      where: { id: params.id },
      select: { creatorId: true, status: true },
    })

    if (!forecast) {
      return apiError('Forecast not found', 404)
    }

    // Only creator or admin can update
    if (forecast.creatorId !== session.user.id && !session.user.isAdmin) {
      return apiError('Forbidden', 403)
    }

    // Can't update resolved or cancelled forecasts
    if (forecast.status === 'RESOLVED' || forecast.status === 'CANCELLED') {
      return apiError('Cannot update resolved or cancelled forecasts', 400)
    }

    const body = await request.json()
    const data = updateForecastSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    
    if (data.title) updateData.title = data.title
    if (data.text !== undefined) updateData.text = data.text
    if (data.sourceArticles !== undefined) {
      updateData.sourceArticles = data.sourceArticles ?? undefined
    }
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate)
    if (data.status) updateData.status = data.status

    const updated = await prisma.forecast.update({
      where: { id: params.id },
      data: updateData,
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
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

    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error, 'Failed to update forecast')
  }
}

// DELETE /api/forecasts/[id] - Delete a forecast
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const forecast = await prisma.forecast.findUnique({
      where: { id: params.id },
      select: { creatorId: true, status: true },
    })

    if (!forecast) {
      return apiError('Forecast not found', 404)
    }

    // Only creator or admin can delete
    if (forecast.creatorId !== session.user.id && !session.user.isAdmin) {
      return apiError('Forbidden', 403)
    }

    // Can only delete drafts (cancel active ones instead)
    if (forecast.status !== 'DRAFT') {
      return apiError('Can only delete draft forecasts. Use cancel for active forecasts.', 400)
    }

    await prisma.forecast.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to delete forecast')
  }
}
