import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { apiError, handleRouteError } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/forecasts/[id]/reject - Reject a PENDING_APPROVAL forecast
export const POST = withAuth(async (request, user, { params }) => {
  try {
    const body = await request.json()
    const { keywords, description } = body

    const prediction = await prisma.prediction.findUnique({
      where: { id: params.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            isBot: true,
          },
        },
      },
    })

    if (!prediction) {
      return apiError('Prediction not found', 404)
    }

    // Only allow rejection of bot-created forecasts
    if (!prediction.author.isBot) {
      return apiError('Only bot-created forecasts can be rejected via this endpoint', 400)
    }

    // Can only reject pending forecasts
    if (prediction.status !== 'PENDING_APPROVAL') {
      return apiError('Forecast is not awaiting approval', 400)
    }

    // Transition to VOID
    const now = new Date()
    const updated = await prisma.prediction.update({
      where: { id: params.id },
      data: {
        status: 'VOID',
        resolutionOutcome: 'void',
        resolvedAt: now,
        resolutionNote: 'Rejected during approval workflow',
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    })

    // Create BotRejectedTopic entry to prevent future suggestions
    // Extract keywords from the forecast claim/details
    const extractedKeywords = keywords || [
      ...prediction.claimText.toLowerCase().split(/\s+/).slice(0, 5),
    ]

    const topicDescription = description || prediction.claimText.substring(0, 200)

    // Get the bot's config to find BotRejectedTopic relation
    const botConfig = await prisma.botConfig.findUnique({
      where: { userId: prediction.author.id },
    })

    if (botConfig) {
      await prisma.botRejectedTopic.create({
        data: {
          botId: botConfig.id,
          keywords: extractedKeywords,
          description: topicDescription,
          rejectedById: user.id,
        },
      })
    }

    return NextResponse.json({
      success: true,
      prediction: updated,
      message: 'Forecast rejected and topic added to rejection list',
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to reject prediction')
  }
})
