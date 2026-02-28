import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updatePredictionSchema } from '@/lib/validations/prediction'
import { apiError, handleRouteError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { transitionIfExpired } from '@/lib/services/prediction-lifecycle'

export const dynamic = 'force-dynamic'

type RouteParams = {
  params: { id: string }
}

// GET /api/predictions/[id] - Get a single prediction (supports ID or slug)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Transition this prediction to PENDING if it's past its deadline
    await transitionIfExpired(params.id)

    // Try to find by ID, slug, or shareToken
    const prediction = await prisma.prediction.findFirst({
      where: {
        OR: [
          { id: params.id },
          { slug: params.id },
          { shareToken: params.id },
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

    // Access gate for private forecasts
    if (!prediction.isPublic) {
      const accessedViaToken = params.id === prediction.shareToken
      const session = await getServerSession(authOptions)
      const isAuthor = session?.user?.id === prediction.authorId
      const isAdmin = session?.user?.role === 'ADMIN'
      if (!accessedViaToken && !isAuthor && !isAdmin) {
        return apiError('Prediction not found', 404)
      }
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
export const PATCH = withAuth(async (request, user, { params }) => {
  const prediction = await prisma.prediction.findUnique({
    where: { id: params.id },
    select: { authorId: true, status: true, lockedAt: true },
  })

  if (!prediction) {
    return apiError('Prediction not found', 404)
  }

  // Only author or admin can update
  if (prediction.authorId !== user.id && user.role !== 'ADMIN') {
    return apiError('Forbidden', 403)
  }

  const body = await request.json()

  // Can only update drafts (unless admin), except isPublic toggle is always allowed
  if (prediction.status !== 'DRAFT' && user.role !== 'ADMIN') {
    const nonVisibilityKeys = Object.keys(body).filter(k => k !== 'isPublic')
    if (nonVisibilityKeys.length > 0) {
      return apiError('Cannot update published predictions', 400)
    }
  }

  // Enforce immutability for locked forecasts
  if (prediction.lockedAt && user.role !== 'ADMIN') {
    const restrictedFields = ['claimText', 'detailsText', 'outcomePayload']
    const attemptedRestrictedUpdates = Object.keys(body).filter(key => restrictedFields.includes(key))
    if (attemptedRestrictedUpdates.length > 0) {
      return apiError(`Cannot update restricted fields (${attemptedRestrictedUpdates.join(', ')}) on a locked forecast`, 400)
    }
  }

  const data = updatePredictionSchema.parse(body)

  // Validate resolve-by if provided
  if (data.resolveByDatetime && new Date(data.resolveByDatetime) <= new Date()) {
    return apiError('Resolution date must be in the future', 400)
  }

  const updateData: Record<string, unknown> = {}
  if (data.claimText) updateData.claimText = data.claimText
  if (data.detailsText !== undefined) updateData.detailsText = data.detailsText
  if (data.outcomePayload) updateData.outcomePayload = data.outcomePayload
  if (data.resolutionRules !== undefined) updateData.resolutionRules = data.resolutionRules
  if (data.resolveByDatetime) updateData.resolveByDatetime = new Date(data.resolveByDatetime)
  if (data.isPublic !== undefined) updateData.isPublic = data.isPublic

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
})

// DELETE /api/predictions/[id] - Delete a prediction (draft only)
export const DELETE = withAuth(async (_request, user, { params }) => {
  const prediction = await prisma.prediction.findUnique({
    where: { id: params.id },
    select: { authorId: true, status: true },
  })

  if (!prediction) {
    return apiError('Prediction not found', 404)
  }

  if (prediction.authorId !== user.id && user.role !== 'ADMIN') {
    return apiError('Forbidden', 403)
  }

  if (prediction.status !== 'DRAFT' && user.role !== 'ADMIN') {
    return apiError('Can only delete draft predictions', 400)
  }

  await prisma.prediction.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
})
