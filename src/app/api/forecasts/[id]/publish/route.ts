import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { apiError, handleRouteError } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'
import { notifyForecastPublished } from '@/lib/services/telegram'

export const dynamic = 'force-dynamic'

// POST /api/forecasts/[id]/publish - Publish a forecast (DRAFT → ACTIVE)
export const POST = withAuth(async (_request, user, { params }) => {
  try {
    const prediction = await prisma.prediction.findUnique({
      where: { id: params.id },
      include: {
        options: true,
      },
    })

    if (!prediction) {
      return apiError('Prediction not found', 404)
    }

    // Only author can publish
    if (prediction.authorId !== user.id) {
      return apiError('Forbidden', 403)
    }

    // Can only publish drafts
    if (prediction.status !== 'DRAFT') {
      return apiError('Prediction is already published', 400)
    }

    // Validate prediction is complete
    if (!prediction.claimText || prediction.claimText.length < 10) {
      return apiError('Claim text must be at least 10 characters', 400)
    }

    if (prediction.resolveByDatetime <= new Date()) {
      return apiError('Resolution date must be in the future', 400)
    }

    // For multiple choice, ensure options exist
    if (prediction.outcomeType === 'MULTIPLE_CHOICE' && prediction.options.length < 2) {
      return apiError('Multiple choice predictions need at least 2 options', 400)
    }

    // Publish the prediction
    const now = new Date()
    const updated = await prisma.prediction.update({
      where: { id: params.id },
      data: {
        status: 'ACTIVE',
        publishedAt: now,
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

    notifyForecastPublished(updated, updated.author)

    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error, 'Failed to publish prediction')
  }
})
