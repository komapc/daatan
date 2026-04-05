import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const log = createLogger('prediction-resolution')

export type ResolutionOutcome = 'correct' | 'wrong' | 'void' | 'unresolvable'

interface ResolutionOptions {
  outcome: ResolutionOutcome
  resolvedById: string
  evidenceLinks?: string[]
  resolutionNote?: string
  correctOptionId?: string
}

/**
 * Resolve a prediction: update its status and compute Brier-based ΔRS for each commitment.
 *
 * Brier ΔRS: brierScore = (p − outcome)², rsChange = round((0.25 − BS) × 100)
 * BINARY:          p = (confidence + 100) / 200
 * MULTIPLE_CHOICE: p = confidence / 100
 *
 * Void/unresolvable outcomes produce no RS change.
 *
 * Returns the updated prediction record.
 * Throws if the prediction is not found, not in a resolvable state, or if
 * correctOptionId is missing/invalid for MULTIPLE_CHOICE predictions.
 */
export async function resolvePrediction(predictionId: string, options: ResolutionOptions) {
  const { outcome, resolvedById, evidenceLinks, resolutionNote, correctOptionId } = options

  const prediction = await prisma.prediction.findUnique({
    where: { id: predictionId },
    include: {
      options: true,
      commitments: {
        include: { user: { select: { id: true, rs: true } } },
      },
    },
  })

  if (!prediction) {
    throw Object.assign(new Error('Prediction not found'), { statusCode: 404 })
  }

  if (prediction.status !== 'ACTIVE' && prediction.status !== 'PENDING') {
    throw Object.assign(new Error('Prediction cannot be resolved'), { statusCode: 400 })
  }

  const isMultipleChoice = prediction.outcomeType === 'MULTIPLE_CHOICE'
  if (isMultipleChoice && (outcome === 'correct' || outcome === 'wrong')) {
    if (!correctOptionId) {
      throw Object.assign(new Error('correctOptionId is required for multiple choice predictions'), { statusCode: 400 })
    }
    if (!prediction.options.some((o) => o.id === correctOptionId)) {
      throw Object.assign(new Error('correctOptionId does not match any option for this prediction'), { statusCode: 400 })
    }
  }

  let newStatus: 'RESOLVED_CORRECT' | 'RESOLVED_WRONG' | 'VOID' | 'UNRESOLVABLE'
  if (outcome === 'correct') newStatus = 'RESOLVED_CORRECT'
  else if (outcome === 'wrong') newStatus = 'RESOLVED_WRONG'
  else if (outcome === 'void') newStatus = 'VOID'
  else newStatus = 'UNRESOLVABLE'

  const isVoidOutcome = outcome === 'void' || outcome === 'unresolvable'

  const result = await prisma.$transaction(async (tx) => {
    const updatedPrediction = await tx.prediction.update({
      where: { id: predictionId },
      data: {
        status: newStatus,
        resolvedAt: new Date(),
        resolvedById,
        resolutionOutcome: outcome,
        evidenceLinks: evidenceLinks ?? undefined,
        resolutionNote,
      },
    })

    if (isMultipleChoice && correctOptionId && (outcome === 'correct' || outcome === 'wrong')) {
      for (const option of prediction.options) {
        await tx.predictionOption.update({
          where: { id: option.id },
          data: { isCorrect: option.id === correctOptionId },
        })
      }
    }

    for (const commitment of prediction.commitments) {
      let rsChange = 0
      let brierScore: number | null = null

      if (!isVoidOutcome) {
        // cuCommitted stores the confidence value: -100..100 for BINARY, 0..100 for MULTIPLE_CHOICE
        const confidence = commitment.cuCommitted
        let p: number
        let outcomeNumeric: number

        if (isMultipleChoice) {
          p = confidence / 100
          outcomeNumeric = commitment.optionId === correctOptionId ? 1 : 0
        } else {
          p = (confidence + 100) / 200
          outcomeNumeric = outcome === 'correct' ? 1 : 0
        }

        brierScore = Math.pow(p - outcomeNumeric, 2)
        rsChange = Math.round((0.25 - brierScore) * 100)
      }

      await tx.commitment.update({
        where: { id: commitment.id },
        data: {
          rsChange,
          ...(brierScore !== null && { brierScore }),
        },
      })

      const newRs = Math.max(0, commitment.user.rs + rsChange)
      await tx.user.update({
        where: { id: commitment.userId },
        data: { rs: newRs },
      })
    }

    return updatedPrediction
  })

  log.info(
    { predictionId, outcome, commitmentCount: prediction.commitments.length },
    'Prediction resolved',
  )

  return { result, prediction }
}
