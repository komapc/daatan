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
 * Resolve a prediction: update its status, process all commitments, distribute
 * winners pool bonus, and refund burned CU on void outcomes.
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
        include: { user: true },
      },
      withdrawals: {
        where: { cuBurned: { gt: 0 } },
        select: { userId: true, cuBurned: true },
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
  const outcomeNumeric = outcome === 'correct' ? 1 : 0

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

    const winnerCommitments: typeof prediction.commitments = []

    for (const commitment of prediction.commitments) {
      let cuReturned = 0
      let rsChange = 0

      if (isVoidOutcome) {
        cuReturned = commitment.cuCommitted
      } else {
        let wasCorrect = false
        if (isMultipleChoice) {
          wasCorrect = commitment.optionId === correctOptionId
        } else {
          wasCorrect =
            (outcome === 'correct' && commitment.binaryChoice === true) ||
            (outcome === 'wrong' && commitment.binaryChoice === false)
        }

        if (wasCorrect) {
          cuReturned = Math.floor(commitment.cuCommitted * 1.5)
          rsChange = commitment.cuCommitted * 0.1
          winnerCommitments.push(commitment)
        } else {
          cuReturned = 0
          rsChange = -commitment.cuCommitted * 0.05
        }
      }

      const brierScore =
        !isVoidOutcome && commitment.probability != null
          ? Math.pow(commitment.probability - outcomeNumeric, 2)
          : null

      await tx.commitment.update({
        where: { id: commitment.id },
        data: {
          cuReturned,
          rsChange,
          ...(brierScore !== null && { brierScore }),
        },
      })

      const newCuAvailable = commitment.user.cuAvailable + cuReturned
      const newCuLocked = Math.max(0, commitment.user.cuLocked - commitment.cuCommitted)
      const newRs = Math.max(0, commitment.user.rs + rsChange)

      await tx.user.update({
        where: { id: commitment.userId },
        data: { cuAvailable: newCuAvailable, cuLocked: newCuLocked, rs: newRs },
      })

      await tx.cuTransaction.create({
        data: {
          userId: commitment.userId,
          type: isVoidOutcome ? 'REFUND' : 'COMMITMENT_UNLOCK',
          amount: cuReturned,
          referenceId: commitment.id,
          note: `Prediction resolved: ${outcome}`,
          balanceAfter: newCuAvailable,
        },
      })
    }

    if (!isVoidOutcome && winnerCommitments.length > 0 && prediction.winnersPoolBonus > 0) {
      const totalWinnerCU = winnerCommitments.reduce((sum, c) => sum + c.cuCommitted, 0)
      for (const winner of winnerCommitments) {
        const bonusShare = winner.cuCommitted / totalWinnerCU
        const bonusCU = Math.floor(prediction.winnersPoolBonus * bonusShare)
        if (bonusCU > 0) {
          const updatedWinner = await tx.user.update({
            where: { id: winner.userId },
            data: { cuAvailable: { increment: bonusCU } },
            select: { cuAvailable: true },
          })
          await tx.cuTransaction.create({
            data: {
              userId: winner.userId,
              type: 'BONUS',
              amount: bonusCU,
              referenceId: prediction.id,
              note: `Exit penalty pool bonus (${Math.round(bonusShare * 100)}% of winners pool)`,
              balanceAfter: updatedWinner.cuAvailable,
            },
          })
        }
      }
    }

    if (isVoidOutcome && prediction.withdrawals.length > 0) {
      for (const withdrawal of prediction.withdrawals) {
        const updatedExiter = await tx.user.update({
          where: { id: withdrawal.userId },
          data: { cuAvailable: { increment: withdrawal.cuBurned } },
          select: { cuAvailable: true },
        })
        await tx.cuTransaction.create({
          data: {
            userId: withdrawal.userId,
            type: 'VOID_BURN_REFUND',
            amount: withdrawal.cuBurned,
            referenceId: prediction.id,
            note: `Burn penalty refunded — prediction resolved as ${outcome}`,
            balanceAfter: updatedExiter.cuAvailable,
          },
        })
      }
      await tx.prediction.update({
        where: { id: predictionId },
        data: { winnersPoolBonus: 0 },
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
