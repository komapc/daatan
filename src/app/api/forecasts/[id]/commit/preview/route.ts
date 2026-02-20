import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { calculatePenalty } from '@/lib/services/commitment'

/**
 * GET /api/forecasts/[id]/commit/preview
 * Returns penalty preview for removing an existing commitment.
 * Read-only — no side effects.
 */
export const GET = withAuth(async (_request, user, { params }) => {
  const predictionId = params.id

  const commitment = await prisma.commitment.findUnique({
    where: { userId_predictionId: { userId: user.id, predictionId } },
    select: {
      cuCommitted: true,
      binaryChoice: true,
      optionId: true,
    },
  })

  if (!commitment) {
    return apiError('No commitment found', 404)
  }

  // Compute pool state
  const commitments = await prisma.commitment.findMany({
    where: { predictionId },
    select: { cuCommitted: true, binaryChoice: true, optionId: true },
  })

  let totalPoolCU = 0
  let yourSideCU = 0
  for (const c of commitments) {
    totalPoolCU += c.cuCommitted
    if (commitment.optionId !== null && commitment.optionId !== undefined) {
      if (c.optionId === commitment.optionId) yourSideCU += c.cuCommitted
    } else {
      if (c.binaryChoice === commitment.binaryChoice) yourSideCU += c.cuCommitted
    }
  }

  const { cuBurned, cuRefunded, burnRate } = calculatePenalty(
    commitment.cuCommitted,
    yourSideCU,
    totalPoolCU,
  )

  return NextResponse.json({
    cuCommitted: commitment.cuCommitted,
    cuBurned,
    cuRefunded,
    burnRate,
    totalPoolCU,
    yourSideCU,
  })
})
