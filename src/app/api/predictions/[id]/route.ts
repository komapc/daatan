import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updatePredictionSchema } from '@/lib/validations/prediction'
import { apiError, handleRouteError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

type RouteParams = {
  params: { id: string }
}

// GET /api/predictions/[id] - Get a single prediction (supports ID or slug)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    
    // Try to find by ID first, then by slug
    const prediction = await prisma.prediction.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { id: params.id },
          { slug: params.id },
        ],
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            rs: true,
            role: true,
          },
        },
        newsAnchor: true,
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        commitments: {
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
            option: {
              select: {
                id: true,
                text: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        _count: {
          select: { commitments: true },
        },
      },
    })

    if (!prediction) {
      return apiError('Prediction not found', 404)
    }

    // Calculate total CU committed
    const totalCuCommitted = prediction.commitments.reduce(
      (sum, c) => sum + c.cuCommitted,
      0
    )

    return NextResponse.json({
      ...prediction,
      totalCuCommitted,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch prediction')
  }
}

// PATCH /api/predictions/[id] - Update a prediction (draft only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const prediction = await prisma.prediction.findUnique({
      where: { id: params.id },
      select: { authorId: true, status: true },
    })

    if (!prediction) {
      return apiError('Prediction not found', 404)
    }

    // Only author or admin can update
    if (prediction.authorId !== session.user.id && session.user.role !== 'ADMIN') {
      return apiError('Forbidden', 403)
    }

    // Can only update drafts (unless admin)
    if (prediction.status !== 'DRAFT' && session.user.role !== 'ADMIN') {
      return apiError('Cannot update published predictions', 400)
    }

    const body = await request.json()
    const data = updatePredictionSchema.parse(body)

    // Validate resolve-by if provided
    if (data.resolveByDatetime && new Date(data.resolveByDatetime) <= new Date()) {
      return apiError('Resolution date must be in the future', 400)
    }

    const updateData: Record<string, unknown> = {}
    if (data.claimText) updateData.claimText = data.claimText
    if (data.detailsText !== undefined) updateData.detailsText = data.detailsText
    if (data.domain !== undefined) updateData.domain = data.domain
    if (data.outcomePayload) updateData.outcomePayload = data.outcomePayload
    if (data.resolutionRules !== undefined) updateData.resolutionRules = data.resolutionRules
    if (data.resolveByDatetime) updateData.resolveByDatetime = new Date(data.resolveByDatetime)

    const updated = await prisma.prediction.update({
      where: { id: params.id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        newsAnchor: true,
        options: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error, 'Failed to update prediction')
  }
}

// DELETE /api/predictions/[id] - Delete a prediction (draft only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const prediction = await prisma.prediction.findUnique({
      where: { id: params.id },
      select: { authorId: true, status: true },
    })

    if (!prediction) {
      return apiError('Prediction not found', 404)
    }

    if (prediction.authorId !== session.user.id && session.user.role !== 'ADMIN') {
      return apiError('Forbidden', 403)
    }

    if (prediction.status !== 'DRAFT' && session.user.role !== 'ADMIN') {
      return apiError('Can only delete draft predictions', 400)
    }

    await prisma.prediction.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to delete prediction')
  }
}

