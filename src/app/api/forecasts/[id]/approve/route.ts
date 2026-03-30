import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { apiError, handleRouteError } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'
import { createCommitment } from '@/lib/services/commitment'
import { notifyBotForecastApproved } from '@/lib/services/telegram'
import { createLogger } from '@/lib/logger'

const log = createLogger('approve-route')

export const dynamic = 'force-dynamic'

// POST /api/forecasts/[id]/approve - Approve a PENDING_APPROVAL forecast and stake on it
export const POST = withAuth(async (_request, user, { params }) => {
  try {
    const prediction = await prisma.prediction.findUnique({
      where: { id: params.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            isBot: true,
          },
        },
        options: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    })

    if (!prediction) {
      return apiError('Prediction not found', 404)
    }

    // Only allow approval of bot-created forecasts
    if (!prediction.author.isBot) {
      return apiError('Only bot-created forecasts can be approved via this endpoint', 400)
    }

    // Can only approve pending forecasts
    if (prediction.status !== 'PENDING_APPROVAL') {
      return apiError('Forecast is not awaiting approval', 400)
    }

    // Transition to ACTIVE and update publishedAt
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
            isBot: true,
          },
        },
        options: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    })

    // Now stake on the forecast using the bot's configured stake range
    const botConfig = await prisma.botConfig.findUnique({
      where: { userId: prediction.author.id },
    })

    if (botConfig) {
      const stakeAmount = Math.floor(Math.random() * (botConfig.stakeMax - botConfig.stakeMin + 1)) + botConfig.stakeMin
      const stakeResult = await createCommitment(prediction.author.id, prediction.id, {
        cuCommitted: stakeAmount,
        binaryChoice: true, // Bot always votes YES on its own forecast
      })

      if (!stakeResult.ok) {
        // Log the warning but don't fail the approval - forecast is now active
        log.warn(
          { botId: prediction.author.id, predictionId: prediction.id, error: stakeResult.error },
          'Failed to stake on approved forecast'
        )
      }
    }

    // Fetch approver info for notification
    const approver = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, username: true },
    })
    if (approver) {
      notifyBotForecastApproved(updated, updated.author, approver)
    }

    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error, 'Failed to approve prediction')
  }
}, { roles: ['ADMIN', 'APPROVER'] })
