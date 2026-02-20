import { prisma } from '@/lib/prisma'
import type { Prisma, PredictionOption } from '@prisma/client'
import { notifyNewCommitment } from '@/lib/services/telegram'
import { createNotification } from '@/lib/services/notification'
import { createLogger } from '@/lib/logger'

const log = createLogger('commitment-service')

/** Minimal user fields needed for commitment operations. */
interface CommitmentUser {
  id: string
  cuAvailable: number
  cuLocked: number
  rs: number
}

/** Prediction with options, as needed for commitment validation. */
interface CommitmentPrediction {
  id: string
  status: string
  authorId: string
  outcomeType: string
  claimText: string
  slug: string | null
  lockedAt: Date | null
  options: PredictionOption[]
}

/** Data validated by createCommitmentSchema. */
interface CreateCommitmentData {
  cuCommitted: number
  binaryChoice?: boolean
  optionId?: string
}

/** Data validated by updateCommitmentSchema. */
interface UpdateCommitmentData {
  cuCommitted?: number
  binaryChoice?: boolean
  optionId?: string
}

/** Standard result from a service operation. */
type ServiceResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number }

// ============================================
// Penalty helpers
// ============================================

interface PoolState {
  totalPoolCU: number
  yourSideCU: number
}

/**
 * Compute pool state for penalty calculation.
 * yourSideCU includes the user's own commitment.
 */
async function computePoolState(
  predictionId: string,
  userId: string,
  binaryChoice: boolean | null | undefined,
  optionId: string | null | undefined,
): Promise<PoolState> {
  const commitments = await prisma.commitment.findMany({
    where: { predictionId },
    select: { userId: true, cuCommitted: true, binaryChoice: true, optionId: true },
  })

  let totalPoolCU = 0
  let yourSideCU = 0

  for (const c of commitments) {
    totalPoolCU += c.cuCommitted
    // Determine if on same side as the exiting user
    if (optionId !== undefined && optionId !== null) {
      if (c.optionId === optionId) yourSideCU += c.cuCommitted
    } else {
      if (c.binaryChoice === binaryChoice) yourSideCU += c.cuCommitted
    }
  }

  return { totalPoolCU, yourSideCU }
}

/** Pure penalty calculation — no side effects. */
export function calculatePenalty(
  cuCommitted: number,
  yourSideCU: number,
  totalPoolCU: number,
): { cuBurned: number; cuRefunded: number; burnRate: number } {
  if (totalPoolCU === 0) {
    return { cuBurned: 0, cuRefunded: cuCommitted, burnRate: 0 }
  }
  // yourSideShare includes own commitment
  const yourSideShare = yourSideCU / totalPoolCU
  const burnRateFraction = Math.max(0.10, yourSideShare)
  const cuBurned = Math.floor(cuCommitted * burnRateFraction)
  return {
    cuBurned,
    cuRefunded: cuCommitted - cuBurned,
    burnRate: Math.round(burnRateFraction * 100),
  }
}

// ============================================
// Validation helpers
// ============================================

function validateCommitEligibility(
  prediction: CommitmentPrediction,
  userId: string,
): ServiceResult<never> | null {
  if (prediction.status !== 'ACTIVE') {
    return { ok: false, error: 'Can only commit to active predictions', status: 400 }
  }
  return null
}

function validateOutcomeChoice(
  prediction: CommitmentPrediction,
  data: CreateCommitmentData,
): ServiceResult<never> | null {
  if (prediction.outcomeType === 'MULTIPLE_CHOICE') {
    if (!data.optionId) {
      return { ok: false, error: 'Must select an option for multiple choice predictions', status: 400 }
    }
    const optionExists = prediction.options.some((o) => o.id === data.optionId)
    if (!optionExists) {
      return { ok: false, error: 'Invalid option', status: 400 }
    }
  }
  if (prediction.outcomeType === 'BINARY' && data.binaryChoice === undefined) {
    return { ok: false, error: 'Must specify binaryChoice for binary predictions', status: 400 }
  }
  return null
}

// ============================================
// Service functions
// ============================================

/** Include clause for commitment responses (user + option). */
const commitmentInclude = {
  user: {
    select: { id: true, name: true, username: true, image: true },
  },
  option: {
    select: { id: true, text: true },
  },
} satisfies Prisma.CommitmentInclude

/**
 * Create a new commitment on a prediction.
 * Handles validation, CU locking, ledger entry, and first-commit lock.
 */
export async function createCommitment(
  userId: string,
  predictionId: string,
  data: CreateCommitmentData,
): Promise<ServiceResult<Prisma.CommitmentGetPayload<{ include: typeof commitmentInclude }>>> {
  // Fetch prediction and user in parallel
  const [prediction, user] = await Promise.all([
    prisma.prediction.findUnique({
      where: { id: predictionId },
      include: { options: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, cuAvailable: true, cuLocked: true, rs: true },
    }),
  ])

  if (!prediction) return { ok: false, error: 'Prediction not found', status: 404 }
  if (!user) return { ok: false, error: 'User not found', status: 404 }

  // Eligibility checks
  const eligibilityError = validateCommitEligibility(prediction, userId)
  if (eligibilityError) return eligibilityError

  // Check for duplicate
  const existing = await prisma.commitment.findUnique({
    where: { userId_predictionId: { userId, predictionId } },
  })
  if (existing) return { ok: false, error: 'Already committed to this prediction', status: 400 }

  // CU balance check
  if (user.cuAvailable < data.cuCommitted) {
    return { ok: false, error: `Insufficient CU. Available: ${user.cuAvailable}, requested: ${data.cuCommitted}`, status: 400 }
  }

  // Outcome validation
  const outcomeError = validateOutcomeChoice(prediction, data)
  if (outcomeError) return outcomeError

  // Execute atomic transaction
  const commitment = await prisma.$transaction(async (tx) => {
    const isFirstCommitment = await tx.commitment.count({ where: { predictionId } }) === 0

    const created = await tx.commitment.create({
      data: {
        userId,
        predictionId,
        optionId: data.optionId,
        binaryChoice: data.binaryChoice,
        cuCommitted: data.cuCommitted,
        rsSnapshot: user.rs,
      },
      include: commitmentInclude,
    })

    await tx.user.update({
      where: { id: userId },
      data: {
        cuAvailable: { decrement: data.cuCommitted },
        cuLocked: { increment: data.cuCommitted },
      },
    })

    await tx.cuTransaction.create({
      data: {
        userId,
        type: 'COMMITMENT_LOCK',
        amount: -data.cuCommitted,
        referenceId: created.id,
        note: `Committed to prediction: ${prediction.claimText.substring(0, 50)}...`,
        balanceAfter: user.cuAvailable - data.cuCommitted,
      },
    })

    if (isFirstCommitment) {
      await tx.prediction.update({
        where: { id: predictionId },
        data: { lockedAt: new Date() },
      })
    }

    return created
  })

  // Determine choice label for notification
  const choiceLabel = prediction.outcomeType === 'MULTIPLE_CHOICE'
    ? commitment.option?.text ?? 'option'
    : data.binaryChoice ? 'Yes' : 'No'
  notifyNewCommitment(prediction, commitment.user, data.cuCommitted, choiceLabel)

  // Notify forecast author about new commitment
  createNotification({
    userId: prediction.authorId,
    type: 'NEW_COMMITMENT',
    title: 'New commitment on your forecast',
    message: `${commitment.user.name || commitment.user.username || 'Someone'} committed ${data.cuCommitted} CU (${choiceLabel}) on "${prediction.claimText.substring(0, 80)}"`,
    link: `/forecasts/${prediction.slug || prediction.id}`,
    predictionId: prediction.id,
    actorId: userId,
  })

  return { ok: true, data: commitment, status: 201 }
}

/**
 * Remove a commitment and refund CU minus exit penalty.
 * Penalty formula (C3): burnRate = max(10%, yourSideShare).
 * Burns cuBurned into prediction.winnersPoolBonus.
 */
export async function removeCommitment(
  userId: string,
  predictionId: string,
): Promise<ServiceResult<{ success: true; cuBurned: number; cuRefunded: number; burnRate: number }>> {
  const commitment = await prisma.commitment.findUnique({
    where: { userId_predictionId: { userId, predictionId } },
    include: { prediction: { select: { status: true, lockedAt: true, claimText: true } } },
  })

  if (!commitment) return { ok: false, error: 'Commitment not found', status: 404 }
  if (commitment.prediction.status !== 'ACTIVE') {
    return { ok: false, error: 'Cannot remove commitment from non-active predictions', status: 400 }
  }

  // Compute pool state and penalty
  const poolState = await computePoolState(predictionId, userId, commitment.binaryChoice, commitment.optionId)
  const { cuBurned, cuRefunded, burnRate } = calculatePenalty(
    commitment.cuCommitted,
    poolState.yourSideCU,
    poolState.totalPoolCU,
  )

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cuAvailable: true },
  })
  if (!user) return { ok: false, error: 'User not found', status: 404 }

  await prisma.$transaction(async (tx) => {
    await tx.commitment.delete({ where: { id: commitment.id } })

    await tx.commitmentWithdrawal.create({
      data: {
        userId,
        predictionId,
        cuCommitted: commitment.cuCommitted,
        cuBurned,
        cuRefunded,
        burnRate,
      },
    })

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        cuAvailable: { increment: cuRefunded },
        cuLocked: { decrement: commitment.cuCommitted },
      },
    })

    if (cuBurned > 0) {
      await tx.prediction.update({
        where: { id: predictionId },
        data: { winnersPoolBonus: { increment: cuBurned } },
      })

      await tx.cuTransaction.create({
        data: {
          userId,
          type: 'WITHDRAWAL_PENALTY',
          amount: -cuBurned,
          referenceId: commitment.id,
          note: `Exit penalty (${burnRate}%) on: ${commitment.prediction.claimText.substring(0, 50)}...`,
          balanceAfter: updatedUser.cuAvailable,
        },
      })
    }

    await tx.cuTransaction.create({
      data: {
        userId,
        type: 'WITHDRAWAL_REFUND',
        amount: cuRefunded,
        referenceId: commitment.id,
        note: `Commitment withdrawn (${cuBurned > 0 ? `${burnRate}% penalty applied` : 'no penalty'})`,
        balanceAfter: updatedUser.cuAvailable,
      },
    })
  })

  log.info({ userId, predictionId, cuBurned, cuRefunded, burnRate }, 'Commitment removed with penalty')

  return { ok: true, data: { success: true, cuBurned, cuRefunded, burnRate }, status: 200 }
}

/**
 * Update an existing commitment (CU amount only after lock).
 * Rules:
 * - Rule 1: Cannot increase CU after prediction is locked (lockedAt set)
 * - Rule 3: Cannot change side (binaryChoice/optionId) after lock — must exit and re-commit
 */
export async function updateCommitment(
  userId: string,
  predictionId: string,
  data: UpdateCommitmentData,
): Promise<ServiceResult<Prisma.CommitmentGetPayload<{ include: typeof commitmentInclude }>>> {
  const [commitment, user] = await Promise.all([
    prisma.commitment.findUnique({
      where: { userId_predictionId: { userId, predictionId } },
      include: { prediction: { include: { options: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, cuAvailable: true, cuLocked: true, rs: true },
    }),
  ])

  if (!commitment) return { ok: false, error: 'Commitment not found', status: 404 }
  if (!user) return { ok: false, error: 'User not found', status: 404 }

  if (commitment.prediction.status !== 'ACTIVE') {
    return { ok: false, error: 'Can only update commitments on active predictions', status: 400 }
  }

  const isLocked = commitment.prediction.lockedAt !== null

  // Rule 3: No side changes after lock
  if (isLocked && (data.binaryChoice !== undefined || data.optionId !== undefined)) {
    return {
      ok: false,
      error: 'Cannot change side after prediction is locked. Remove your commitment and create a new one.',
      status: 400,
    }
  }

  // Rule 1: No CU increases after lock
  const newCuAmount = data.cuCommitted ?? commitment.cuCommitted
  if (isLocked && newCuAmount > commitment.cuCommitted) {
    return {
      ok: false,
      error: 'Cannot increase commitment after prediction is locked',
      status: 400,
    }
  }

  // Validate option if changing (before lock only)
  if (data.optionId !== undefined) {
    const optionExists = commitment.prediction.options.some((o) => o.id === data.optionId)
    if (!optionExists) return { ok: false, error: 'Invalid option', status: 400 }
  }

  // CU delta calculation
  const cuDelta = newCuAmount - commitment.cuCommitted

  if (cuDelta > 0 && user.cuAvailable < cuDelta) {
    return { ok: false, error: `Insufficient CU. Available: ${user.cuAvailable}, additional needed: ${cuDelta}`, status: 400 }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.commitment.update({
      where: { id: commitment.id },
      data: {
        cuCommitted: newCuAmount,
        binaryChoice: data.binaryChoice !== undefined ? data.binaryChoice : commitment.binaryChoice,
        optionId: data.optionId !== undefined ? data.optionId : commitment.optionId,
        rsSnapshot: user.rs,
      },
      include: commitmentInclude,
    })

    if (cuDelta !== 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          cuAvailable: { decrement: cuDelta },
          cuLocked: { increment: cuDelta },
        },
      })

      await tx.cuTransaction.create({
        data: {
          userId,
          type: cuDelta > 0 ? 'COMMITMENT_LOCK' : 'REFUND',
          amount: cuDelta > 0 ? -cuDelta : Math.abs(cuDelta),
          referenceId: commitment.id,
          note: `${cuDelta > 0 ? 'Increased' : 'Decreased'} commitment on: ${commitment.prediction.claimText.substring(0, 50)}...`,
          balanceAfter: user.cuAvailable - cuDelta,
        },
      })
    }

    return updated
  })

  return { ok: true, data: result, status: 200 }
}
