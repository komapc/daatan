import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolvePredictionSchema } from '@/lib/validations/prediction'
import { apiError, handleRouteError } from '@/lib/api-error'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    // Check if user is moderator or admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isModerator: true, isAdmin: true },
    })

    if (!user?.isModerator && !user?.isAdmin) {
      return apiError('Only moderators can resolve predictions', 403)
    }

    const body = await request.json()
    const { outcome, evidenceLinks, resolutionNote } = resolvePredictionSchema.parse(body)

    // Get prediction with commitments
    const prediction = await prisma.prediction.findUnique({
      where: { id: params.id },
      include: {
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
        where: { id: params.id },
        data: {
          status: newStatus,
          resolvedAt: new Date(),
          resolvedById: session.user.id,
          resolutionOutcome: outcome,
          evidenceLinks: evidenceLinks ? evidenceLinks : undefined,
          resolutionNote,
        },
      })

      // Process each commitment
      for (const commitment of prediction.commitments) {
        let cuReturned = 0
        let rsChange = 0

        if (outcome === 'void' || outcome === 'unresolvable') {
          // Refund CU, no RS change
          cuReturned = commitment.cuCommitted
        } else {
          // Determine if user was correct
          const wasCorrect =
            (outcome === 'correct' && commitment.binaryChoice === true) ||
            (outcome === 'wrong' && commitment.binaryChoice === false)

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
        const newCuLocked = commitment.user.cuLocked - commitment.cuCommitted
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

    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to resolve prediction')
  }
}
