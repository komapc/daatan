import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { apiError, handleRouteError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const patchPredictionSchema = z.object({
  claimText: z.string().min(5).max(500).optional(),
  detailsText: z.string().max(2000).optional().nullable(),
  resolutionRules: z.string().max(1000).optional().nullable(),
  resolveByDatetime: z.string().datetime().optional(),
  isPublic: z.boolean().optional(),
  options: z.array(z.string().min(1).max(500)).min(2).max(10).optional(),
})

// GET /api/forecasts/[id] - Get single forecast details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idOrSlug } = await params

    const prediction = await prisma.prediction.findFirst({
      where: { 
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug }
        ]
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
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, name: true, username: true, image: true },
            },
            option: {
              select: { id: true, text: true },
            },
          },
        },
        _count: {
          select: { commitments: true },
        },
      },
    })

    if (!prediction) {
      return apiError('Prediction not found', 404, undefined, { notify: true, pathname: request.nextUrl.pathname })
    }

    // Get current user ID for personal commitment context
    let session = null
    try {
      session = await auth()
    } catch {
      // Ignore session errors
    }
    
    const userId = session?.user?.id
    const isAdmin = session?.user?.role === 'ADMIN'

    // Security: check visibility
    if (!prediction.isPublic && prediction.authorId !== userId && !isAdmin) {
      // If it's a private forecast, only author and admin can see it
      return apiError('Prediction not found', 404, undefined, { notify: true, pathname: request.nextUrl.pathname })
    }

    // Find user's specific commitment to this prediction if it exists
    let userCommitment = null
    if (userId) {
      userCommitment = await prisma.commitment.findFirst({
        where: {
          predictionId: prediction.id,
          userId: userId,
        },
        select: {
          id: true,
          cuCommitted: true,
          binaryChoice: true,
          optionId: true,
          createdAt: true,
        }
      })
    }

    // Calculate total CU committed
    const totalCuCommitted = prediction.commitments.reduce((sum, c) => sum + c.cuCommitted, 0)

    return NextResponse.json({
      ...prediction,
      totalCuCommitted,
      userCommitment,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch prediction')
  }
}

// PATCH /api/forecasts/[id] - Update forecast (author only)
export const PATCH = withAuth(async (request, user, { params }) => {
  const { id } = params
  const body = await request.json()
  const data = patchPredictionSchema.parse(body)

  // Check ownership
  const prediction = await prisma.prediction.findUnique({
    where: { id },
    select: { authorId: true, status: true, lockedAt: true },
  })

  if (!prediction) {
    return apiError('Forecast not found', 404)
  }

  const isAdmin = user.role === 'ADMIN'
  const isOwner = prediction.authorId === user.id

  if (!isOwner && !isAdmin) {
    return apiError('Forbidden', 403)
  }

  // Rules:
  // 1. Can only update claimText/details/resolutionRules/resolveBy/options if it's a DRAFT
  // 2. ACTIVE/PENDING forecasts can ONLY update isPublic
  const isPublished = ['ACTIVE', 'PENDING', 'PENDING_APPROVAL'].includes(prediction.status)
  const hasRestrictedChanges = data.claimText || data.detailsText || data.resolutionRules || data.resolveByDatetime || data.options

  if (isPublished && hasRestrictedChanges && !isAdmin) {
    return apiError(`Cannot edit core fields of a published forecast. Status: ${prediction.status}`, 400)
  }

  // 3. Can't edit if lockedAt is set (unless admin)
  if (prediction.lockedAt && !isAdmin) {
    return apiError('Forecast is locked and cannot be edited', 400)
  }

  // Invalidate translation cache when translatable fields change
  const translatableFieldsChanged = data.claimText || data.detailsText !== undefined || data.resolutionRules !== undefined
  if (translatableFieldsChanged) {
    await prisma.predictionTranslation.deleteMany({ where: { predictionId: id } })
  }

  // Perform update
  const updated = await prisma.$transaction(async (tx) => {
    // Update options if provided
    if (data.options) {
      // Delete old options
      await tx.predictionOption.deleteMany({
        where: { predictionId: id },
      })

      // Create new options
      await tx.predictionOption.createMany({
        data: data.options.map((text, index) => ({
          predictionId: id,
          text,
          displayOrder: index,
        })),
      })
    }

    return await tx.prediction.update({
      where: { id },
      data: {
        claimText: data.claimText,
        detailsText: data.detailsText,
        resolutionRules: data.resolutionRules,
        resolveByDatetime: data.resolveByDatetime ? new Date(data.resolveByDatetime) : undefined,
        isPublic: data.isPublic,
      },
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
  })

  return NextResponse.json(updated)
})

// DELETE /api/forecasts/[id] - Delete forecast (DRAFT only, author or admin)
export const DELETE = withAuth(async (_request, user, { params }) => {
  const { id } = params

  // Check ownership and status
  const prediction = await prisma.prediction.findUnique({
    where: { id },
    select: { authorId: true, status: true },
  })

  if (!prediction) {
    return apiError('Forecast not found', 404)
  }

  const isAdmin = user.role === 'ADMIN'
  const isOwner = prediction.authorId === user.id

  if (!isOwner && !isAdmin) {
    return apiError('Forbidden', 403)
  }

  // Only DRAFT forecasts can be deleted to prevent pool manipulation
  if (prediction.status !== 'DRAFT' && !isAdmin) {
    return apiError('Only draft forecasts can be deleted', 400)
  }

  await prisma.prediction.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
})
