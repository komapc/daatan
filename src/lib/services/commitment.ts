import { prisma } from '@/lib/prisma'
import type { Prisma, PredictionOption } from '@prisma/client'
import { notifyNewCommitment } from '@/lib/services/telegram'
import { createNotification } from '@/lib/services/notification'
import { createLogger } from '@/lib/logger'
import type { ServiceResult } from '@/lib/types/service'

const log = createLogger('commitment-service')

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
  confidence: number   // -100..100 for BINARY, 0..100 for MULTIPLE_CHOICE
  optionId?: string
}

/** Data validated by updateCommitmentSchema. */
interface UpdateCommitmentData {
  confidence?: number
  optionId?: string
}

// ============================================
// Validation helpers
// ============================================

function validateCommitEligibility(
  prediction: CommitmentPrediction,
  userId: string,
): ServiceResult<never> | null {
  if (prediction.status !== 'ACTIVE' && prediction.status !== 'PENDING_APPROVAL') {
    return { ok: false, error: 'Can only commit to active or pending approval predictions', status: 400 }
  }
  if (prediction.status === 'PENDING_APPROVAL' && prediction.authorId !== userId) {
    return { ok: false, error: 'Only the author can stake on a forecast pending approval', status: 403 }
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
    if (!prediction.options.some((o) => o.id === data.optionId)) {
      return { ok: false, error: 'Invalid option', status: 400 }
    }
    if (data.confidence < 0 || data.confidence > 100) {
      return { ok: false, error: 'Confidence must be 0–100 for multiple choice predictions', status: 400 }
    }
  }
  return null
}

/** Derive binaryChoice from confidence sign for BINARY predictions. */
function deriveBinaryChoice(outcomeType: string, confidence: number): boolean | null {
  if (outcomeType !== 'BINARY') return null
  return confidence >= 0
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
 * Stores confidence (-100..100) in cuCommitted; derives binaryChoice from sign.
 */
export async function createCommitment(
  userId: string,
  predictionId: string,
  data: CreateCommitmentData,
): Promise<ServiceResult<Prisma.CommitmentGetPayload<{ include: typeof commitmentInclude }>>> {
  const [prediction, user] = await Promise.all([
    prisma.prediction.findUnique({
      where: { id: predictionId },
      include: { options: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, rs: true },
    }),
  ])

  if (!prediction) return { ok: false, error: 'Prediction not found', status: 404 }
  if (!user) return { ok: false, error: 'User not found', status: 404 }

  const eligibilityError = validateCommitEligibility(prediction, userId)
  if (eligibilityError) return eligibilityError

  const existing = await prisma.commitment.findUnique({
    where: { userId_predictionId: { userId, predictionId } },
  })
  if (existing) return { ok: false, error: 'Already committed to this prediction', status: 400 }

  const outcomeError = validateOutcomeChoice(prediction, data)
  if (outcomeError) return outcomeError

  const commitment = await prisma.$transaction(async (tx) => {
    const isFirstCommitment = (await tx.commitment.count({ where: { predictionId } })) === 0

    const created = await tx.commitment.create({
      data: {
        userId,
        predictionId,
        optionId: data.optionId,
        binaryChoice: deriveBinaryChoice(prediction.outcomeType, data.confidence),
        cuCommitted: data.confidence,
        rsSnapshot: user.rs,
      },
      include: commitmentInclude,
    })

    if (isFirstCommitment) {
      await tx.prediction.update({
        where: { id: predictionId },
        data: { lockedAt: new Date() },
      })
    }

    return created
  })

  const choiceLabel = prediction.outcomeType === 'MULTIPLE_CHOICE'
    ? commitment.option?.text ?? 'option'
    : data.confidence >= 0 ? 'Yes' : 'No'

  notifyNewCommitment(prediction, commitment.user, data.confidence, choiceLabel)

  createNotification({
    userId: prediction.authorId,
    type: 'NEW_COMMITMENT',
    title: 'New commitment on your forecast',
    message: `${commitment.user.name || commitment.user.username || 'Someone'} committed with ${data.confidence > 0 ? '+' : ''}${data.confidence} confidence (${choiceLabel}) on "${prediction.claimText.substring(0, 80)}"`,
    link: `/forecasts/${prediction.slug || prediction.id}`,
    predictionId: prediction.id,
    actorId: userId,
  })

  return { ok: true, data: commitment, status: 201 }
}

/**
 * Remove a commitment. No penalty — confidence-based system has no CU to burn.
 */
export async function removeCommitment(
  userId: string,
  predictionId: string,
): Promise<ServiceResult<{ success: true }>> {
  const commitment = await prisma.commitment.findUnique({
    where: { userId_predictionId: { userId, predictionId } },
    include: { prediction: { select: { status: true } } },
  })

  if (!commitment) return { ok: false, error: 'Commitment not found', status: 404 }
  if (commitment.prediction.status !== 'ACTIVE') {
    return { ok: false, error: 'Cannot remove commitment from non-active predictions', status: 400 }
  }

  await prisma.commitment.delete({ where: { id: commitment.id } })

  log.info({ userId, predictionId }, 'Commitment removed')

  return { ok: true, data: { success: true }, status: 200 }
}

/**
 * Update an existing commitment's confidence or option.
 * No penalty — can change freely while prediction is active.
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
      select: { id: true, rs: true },
    }),
  ])

  if (!commitment) return { ok: false, error: 'Commitment not found', status: 404 }
  if (!user) return { ok: false, error: 'User not found', status: 404 }

  if (commitment.prediction.status !== 'ACTIVE') {
    return { ok: false, error: 'Can only update commitments on active predictions', status: 400 }
  }

  if (data.optionId !== undefined) {
    const optionExists = commitment.prediction.options.some((o) => o.id === data.optionId)
    if (!optionExists) return { ok: false, error: 'Invalid option', status: 400 }
  }

  const newConfidence = data.confidence ?? commitment.cuCommitted

  const updated = await prisma.commitment.update({
    where: { id: commitment.id },
    data: {
      cuCommitted: newConfidence,
      binaryChoice: data.confidence !== undefined
        ? deriveBinaryChoice(commitment.prediction.outcomeType, newConfidence)
        : commitment.binaryChoice,
      optionId: data.optionId ?? commitment.optionId,
      rsSnapshot: user.rs,
    },
    include: commitmentInclude,
  })

  return { ok: true, data: updated, status: 200 }
}
