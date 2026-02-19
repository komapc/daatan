import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolvePredictionSchema } from '@/lib/validations/prediction'
import { apiError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { notifyForecastResolved } from '@/lib/services/telegram'
import { createNotification } from '@/lib/services/notification'

export const POST = withAuth(async (request, user, { params }) => {
  const body = await request.json()
  const { outcome, evidenceLinks, resolutionNote, correctOptionId } = resolvePredictionSchema.parse(body)

  const predictionId = params.id

  // Get prediction with commitments and options
  const prediction = await prisma.prediction.findUnique({
    where: { id: predictionId },
    include: {
      options: true,
      commitments: {
        include: {
          user: true,
        },
      },
    },
  })

  if (!prediction) {
    return apiError('Prediction not found', 404)
  }

  if (prediction.status !== 'ACTIVE' && prediction.status !== 'PENDING') {
    return apiError('Prediction cannot be resolved', 400)
  }

  // Validate correctOptionId for MULTIPLE_CHOICE predictions
  const isMultipleChoice = prediction.outcomeType === 'MULTIPLE_CHOICE'
  if (isMultipleChoice && (outcome === 'correct' || outcome === 'wrong')) {
    if (!correctOptionId) {
      return apiError('correctOptionId is required for multiple choice predictions', 400)
    }
    const optionExists = prediction.options.some((o) => o.id === correctOptionId)
    if (!optionExists) {
      return apiError('correctOptionId does not match any option for this prediction', 400)
    }
  }

  // Determine new status based on outcome
  let newStatus: 'RESOLVED_CORRECT' | 'RESOLVED_WRONG' | 'VOID' | 'UNRESOLVABLE'
  if (outcome === 'correct') newStatus = 'RESOLVED_CORRECT'
  else if (outcome === 'wrong') newStatus = 'RESOLVED_WRONG'
  else if (outcome === 'void') newStatus = 'VOID'
  else newStatus = 'UNRESOLVABLE'

  // Use transaction to update prediction and process commitments
  const result = await prisma.$transaction(async (tx) => {
    // Update prediction
    const updatedPrediction = await tx.prediction.update({
      where: { id: predictionId },
      data: {
        status: newStatus,
        resolvedAt: new Date(),
        resolvedById: user.id,
        resolutionOutcome: outcome,
        evidenceLinks: evidenceLinks ? evidenceLinks : undefined,
        resolutionNote,
      },
    })

    // Mark correct option for MULTIPLE_CHOICE predictions
    if (isMultipleChoice && correctOptionId && (outcome === 'correct' || outcome === 'wrong')) {
      for (const option of prediction.options) {
        await tx.predictionOption.update({
          where: { id: option.id },
          data: { isCorrect: option.id === correctOptionId },
        })
      }
    }

    // Process each commitment
    for (const commitment of prediction.commitments) {
      let cuReturned = 0
      let rsChange = 0

      if (outcome === 'void' || outcome === 'unresolvable') {
        // Refund CU, no RS change
        cuReturned = commitment.cuCommitted
      } else {
        // Determine if user was correct based on prediction type
        let wasCorrect = false
        if (isMultipleChoice) {
          // MC: user was correct if they picked the winning option
          wasCorrect = commitment.optionId === correctOptionId
        } else {
          // Binary: user was correct if their choice matches the outcome
          wasCorrect =
            (outcome === 'correct' && commitment.binaryChoice === true) ||
            (outcome === 'wrong' && commitment.binaryChoice === false)
        }

        if (wasCorrect) {
          // Correct prediction: return CU + bonus, increase RS
          cuReturned = Math.floor(commitment.cuCommitted * 1.5) // 50% bonus
          rsChange = commitment.cuCommitted * 0.1 // 10% of committed CU as RS gain
        } else {
          // Wrong prediction: lose CU, decrease RS
          cuReturned = 0
          rsChange = -commitment.cuCommitted * 0.05 // 5% of committed CU as RS loss
        }
      }

      // Update commitment
      await tx.commitment.update({
        where: { id: commitment.id },
        data: {
          cuReturned,
          rsChange,
        },
      })

      // Update user balances
      const newCuAvailable = commitment.user.cuAvailable + cuReturned
      const newCuLocked = Math.max(0, commitment.user.cuLocked - commitment.cuCommitted)
      const newRs = Math.max(0, commitment.user.rs + rsChange) // RS can't go below 0

      await tx.user.update({
        where: { id: commitment.userId },
        data: {
          cuAvailable: newCuAvailable,
          cuLocked: newCuLocked,
          rs: newRs,
        },
      })

      // Create CU transaction record
      await tx.cuTransaction.create({
        data: {
          userId: commitment.userId,
          type: outcome === 'void' || outcome === 'unresolvable' ? 'REFUND' : 'COMMITMENT_UNLOCK',
          amount: cuReturned,
          referenceId: commitment.id,
          note: `Prediction resolved: ${outcome}`,
          balanceAfter: newCuAvailable,
        },
      })
    }

    return updatedPrediction
  })

  notifyForecastResolved(prediction, outcome, prediction.commitments.length)

  // Notify each committer that their committed prediction was resolved
  const forecastLink = `/forecasts/${prediction.slug || prediction.id}`
  for (const commitment of prediction.commitments) {
    createNotification({
      userId: commitment.userId,
      type: 'COMMITMENT_RESOLVED',
      title: 'Your committed forecast was resolved',
      message: `"${prediction.claimText.substring(0, 80)}" was resolved as ${outcome}`,
      link: forecastLink,
      predictionId: prediction.id,
      actorId: user.id,
    })
  }

  return NextResponse.json(result)
}, { roles: ['ADMIN', 'RESOLVER'] })
