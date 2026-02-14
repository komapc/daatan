import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCommitmentSchema, updateCommitmentSchema } from '@/lib/validations/prediction'
import { apiError, handleRouteError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

type RouteParams = {
  params: { id: string }
}

// POST /api/predictions/[id]/commit - Commit CU to a prediction
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const body = await request.json()
    const data = createCommitmentSchema.parse(body)

    // Get prediction and user in parallel
    const [prediction, user] = await Promise.all([
      prisma.prediction.findUnique({
        where: { id: params.id },
        include: { options: true },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, cuAvailable: true, cuLocked: true, rs: true },
      }),
    ])

    if (!prediction) {
      return apiError('Prediction not found', 404)
    }

    if (!user) {
      return apiError('User not found', 404)
    }

    // Can only commit to active predictions
    if (prediction.status !== 'ACTIVE') {
      return apiError('Can only commit to active predictions', 400)
    }

    // Can't commit to own prediction
    if (prediction.authorId === session.user.id) {
      return apiError('Cannot commit to your own prediction', 400)
    }

    // Check if already committed
    const existingCommitment = await prisma.commitment.findUnique({
      where: {
        userId_predictionId: {
          userId: session.user.id,
          predictionId: params.id,
        },
      },
    })

    if (existingCommitment) {
      return apiError('Already committed to this prediction', 400)
    }

    // Check user has enough CU
    if (user.cuAvailable < data.cuCommitted) {
      return apiError(`Insufficient CU. Available: ${user.cuAvailable}, requested: ${data.cuCommitted}`, 400)
    }

    // Validate option for multiple choice
    if (prediction.outcomeType === 'MULTIPLE_CHOICE') {
      if (!data.optionId) {
        return apiError('Must select an option for multiple choice predictions', 400)
      }
      const optionExists = prediction.options.some(o => o.id === data.optionId)
      if (!optionExists) {
        return apiError('Invalid option', 400)
      }
    }

    // For binary, validate binaryChoice
    if (prediction.outcomeType === 'BINARY' && data.binaryChoice === undefined) {
      return apiError('Must specify binaryChoice for binary predictions', 400)
    }

    // Atomic transaction: create commitment + update user CU + create ledger entry
    const result = await prisma.$transaction(async (tx) => {
      // Lock CU for first commitment
      const isFirstCommitment = await tx.commitment.count({
        where: { predictionId: params.id },
      }) === 0

      // Create commitment
      const commitment = await tx.commitment.create({
        data: {
          userId: session.user.id,
          predictionId: params.id,
          optionId: data.optionId,
          binaryChoice: data.binaryChoice,
          cuCommitted: data.cuCommitted,
          rsSnapshot: user.rs,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
          option: {
            select: {
              id: true,
              text: true,
            },
          },
        },
      })

      // Update user CU balances
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          cuAvailable: { decrement: data.cuCommitted },
          cuLocked: { increment: data.cuCommitted },
        },
      })

      // Create ledger entry
      await tx.cuTransaction.create({
        data: {
          userId: session.user.id,
          type: 'COMMITMENT_LOCK',
          amount: -data.cuCommitted,
          referenceId: commitment.id,
          note: `Committed to prediction: ${prediction.claimText.substring(0, 50)}...`,
          balanceAfter: user.cuAvailable - data.cuCommitted,
        },
      })

      // Lock prediction if first commitment
      if (isFirstCommitment) {
        await tx.prediction.update({
          where: { id: params.id },
          data: { lockedAt: new Date() },
        })
      }

      return commitment
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to create commitment')
  }
}

// DELETE /api/predictions/[id]/commit - Remove commitment (only if prediction not locked)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const commitment = await prisma.commitment.findUnique({
      where: {
        userId_predictionId: {
          userId: session.user.id,
          predictionId: params.id,
        },
      },
      include: {
        prediction: {
          select: { status: true, lockedAt: true },
        },
      },
    })

    if (!commitment) {
      return apiError('Commitment not found', 404)
    }

    // Can't remove commitment from locked/resolved predictions
    if (commitment.prediction.status !== 'ACTIVE') {
      return apiError('Cannot remove commitment from non-active predictions', 400)
    }

    // If prediction is locked (has commitments), can't remove
    // This is a policy decision - you might want to allow it
    // For now, we allow removal from active predictions

    // Atomic transaction: delete commitment + update user CU + create ledger entry
    await prisma.$transaction(async (tx) => {
      // Delete commitment
      await tx.commitment.delete({
        where: { id: commitment.id },
      })

      // Refund CU
      const user = await tx.user.update({
        where: { id: session.user.id },
        data: {
          cuAvailable: { increment: commitment.cuCommitted },
          cuLocked: { decrement: commitment.cuCommitted },
        },
      })

      // Create ledger entry
      await tx.cuTransaction.create({
        data: {
          userId: session.user.id,
          type: 'REFUND',
          amount: commitment.cuCommitted,
          referenceId: commitment.id,
          note: 'Commitment withdrawn',
          balanceAfter: user.cuAvailable,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to remove commitment')
  }
}

// PATCH /api/predictions/[id]/commit - Update existing commitment
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const body = await request.json()
    const data = updateCommitmentSchema.parse(body)

    // Get commitment with prediction and user data
    const [commitment, user] = await Promise.all([
      prisma.commitment.findUnique({
        where: {
          userId_predictionId: {
            userId: session.user.id,
            predictionId: params.id,
          },
        },
        include: {
          prediction: {
            include: { options: true },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, cuAvailable: true, cuLocked: true, rs: true },
      }),
    ])

    if (!commitment) {
      return apiError('Commitment not found', 404)
    }

    if (!user) {
      return apiError('User not found', 404)
    }

    // Can only update commitments on active predictions
    if (commitment.prediction.status !== 'ACTIVE') {
      return apiError('Can only update commitments on active predictions', 400)
    }

    // Validate option for multiple choice if changing outcome
    if (data.optionId !== undefined) {
      const optionExists = commitment.prediction.options.some(o => o.id === data.optionId)
      if (!optionExists) {
        return apiError('Invalid option', 400)
      }
    }

    // Calculate CU delta if changing amount
    const newCuAmount = data.cuCommitted ?? commitment.cuCommitted
    const cuDelta = newCuAmount - commitment.cuCommitted

    // If increasing CU, check user has enough available
    if (cuDelta > 0 && user.cuAvailable < cuDelta) {
      return apiError(`Insufficient CU. Available: ${user.cuAvailable}, additional needed: ${cuDelta}`, 400)
    }

    // Atomic transaction: update commitment + adjust user CU + create ledger entries
    const result = await prisma.$transaction(async (tx) => {
      // Update commitment
      const updatedCommitment = await tx.commitment.update({
        where: { id: commitment.id },
        data: {
          cuCommitted: newCuAmount,
          binaryChoice: data.binaryChoice !== undefined ? data.binaryChoice : commitment.binaryChoice,
          optionId: data.optionId !== undefined ? data.optionId : commitment.optionId,
          rsSnapshot: user.rs, // Update RS snapshot to current RS
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
          option: {
            select: {
              id: true,
              text: true,
            },
          },
        },
      })

      // Adjust user CU balances if amount changed
      if (cuDelta !== 0) {
        await tx.user.update({
          where: { id: session.user.id },
          data: {
            cuAvailable: { decrement: cuDelta },
            cuLocked: { increment: cuDelta },
          },
        })

        // Create ledger entry for the adjustment
        if (cuDelta > 0) {
          // Increasing commitment - lock more CU
          await tx.cuTransaction.create({
            data: {
              userId: session.user.id,
              type: 'COMMITMENT_LOCK',
              amount: -cuDelta,
              referenceId: commitment.id,
              note: `Increased commitment on: ${commitment.prediction.claimText.substring(0, 50)}...`,
              balanceAfter: user.cuAvailable - cuDelta,
            },
          })
        } else {
          // Decreasing commitment - refund CU
          await tx.cuTransaction.create({
            data: {
              userId: session.user.id,
              type: 'REFUND',
              amount: Math.abs(cuDelta),
              referenceId: commitment.id,
              note: `Decreased commitment on: ${commitment.prediction.claimText.substring(0, 50)}...`,
              balanceAfter: user.cuAvailable - cuDelta,
            },
          })
        }
      }

      return updatedCommitment
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return handleRouteError(error, 'Failed to update commitment')
  }
}

