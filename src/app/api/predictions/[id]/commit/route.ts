import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCommitmentSchema } from '@/lib/validations/prediction'

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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
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
      return NextResponse.json(
        { error: 'Prediction not found' },
        { status: 404 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Can only commit to active predictions
    if (prediction.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Can only commit to active predictions' },
        { status: 400 }
      )
    }

    // Can't commit to own prediction
    if (prediction.authorId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot commit to your own prediction' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: 'Already committed to this prediction' },
        { status: 400 }
      )
    }

    // Check user has enough CU
    if (user.cuAvailable < data.cuCommitted) {
      return NextResponse.json(
        { error: `Insufficient CU. Available: ${user.cuAvailable}, requested: ${data.cuCommitted}` },
        { status: 400 }
      )
    }

    // Validate option for multiple choice
    if (prediction.outcomeType === 'MULTIPLE_CHOICE') {
      if (!data.optionId) {
        return NextResponse.json(
          { error: 'Must select an option for multiple choice predictions' },
          { status: 400 }
        )
      }
      const optionExists = prediction.options.some(o => o.id === data.optionId)
      if (!optionExists) {
        return NextResponse.json(
          { error: 'Invalid option' },
          { status: 400 }
        )
      }
    }

    // For binary, validate binaryChoice
    if (prediction.outcomeType === 'BINARY' && data.binaryChoice === undefined) {
      return NextResponse.json(
        { error: 'Must specify binaryChoice for binary predictions' },
        { status: 400 }
      )
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
    console.error('Error creating commitment:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create commitment' },
      { status: 500 }
    )
  }
}

// DELETE /api/predictions/[id]/commit - Remove commitment (only if prediction not locked)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
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
      return NextResponse.json(
        { error: 'Commitment not found' },
        { status: 404 }
      )
    }

    // Can't remove commitment from locked/resolved predictions
    if (commitment.prediction.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Cannot remove commitment from non-active predictions' },
        { status: 400 }
      )
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
    console.error('Error removing commitment:', error)
    return NextResponse.json(
      { error: 'Failed to remove commitment' },
      { status: 500 }
    )
  }
}

