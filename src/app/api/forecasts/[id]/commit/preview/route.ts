import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { getCommitmentForPreview } from '@/lib/services/commitment'

/**
 * GET /api/forecasts/[id]/commit/preview
 * Returns Brier ΔRS preview for the user's current commitment.
 *
 * Shows rsIfRight (if the user's prediction is correct) and rsIfWrong.
 * Read-only — no side effects.
 */
export const GET = withAuth(async (_request, user, { params }) => {
  const commitment = await getCommitmentForPreview(user.id, params.id)

  if (!commitment) {
    return apiError('No commitment found', 404)
  }

  const confidence = commitment.cuCommitted  // -100..100 for BINARY, 0..100 for MULTIPLE_CHOICE
  const isMultipleChoice = commitment.prediction.outcomeType === 'MULTIPLE_CHOICE'

  let p: number
  if (isMultipleChoice) {
    p = confidence / 100
  } else {
    p = (confidence + 100) / 200
  }

  // ΔRS if the user is right (their chosen outcome occurs)
  const bsRight = Math.pow(p - 1, 2)
  const rsIfRight = Math.round((0.25 - bsRight) * 100)

  // ΔRS if the user is wrong (the opposite outcome occurs)
  const bsWrong = Math.pow(p - 0, 2)
  const rsIfWrong = Math.round((0.25 - bsWrong) * 100)

  return NextResponse.json({
    confidence,
    probability: Math.round(p * 100),
    rsIfRight,
    rsIfWrong,
  })
})
