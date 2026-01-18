import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolvePredictionSchema } from '@/lib/validations/prediction'

export const dynamic = 'force-dynamic'

const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

type RouteParams = {
  params: { id: string }
}

// POST /api/predictions/[id]/resolve - Resolve a prediction (moderator/admin only)
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

    // Check moderator/admin permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true, isModerator: true },
    })

    if (!user?.isAdmin && !user?.isModerator) {
      return NextResponse.json(
        { error: 'Only moderators and admins can resolve predictions' },
        { status: 403 }
      )
    }

    const prediction = await prisma.prediction.findUnique({
      where: { id: params.id },
      include: {
        commitments: true,
        options: true,
      },
    })

    if (!prediction) {
      return NextResponse.json(
        { error: 'Prediction not found' },
        { status: 404 }
      )
    }

    // Can only resolve active or pending predictions
    if (prediction.status !== 'ACTIVE' && prediction.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only resolve active or pending predictions' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const data = resolvePredictionSchema.parse(body)

    // Validate correct option for multiple choice
    if (prediction.outcomeType === 'MULTIPLE_CHOICE') {
      if (!data.correctOptionId) {
        return NextResponse.json(
          { error: 'Must specify correctOptionId for multiple choice predictions' },
          { status: 400 }
        )
      }
      const optionExists = prediction.options.some(o => o.id === data.correctOptionId)
      if (!optionExists) {
        return NextResponse.json(
          { error: 'Invalid correctOptionId' },
          { status: 400 }
        )
      }
    }

    // Map resolution outcome to status
    const statusMap: Record<string, string> = {
      correct: 'RESOLVED_CORRECT',
      wrong: 'RESOLVED_WRONG',
      void: 'VOID',
      unresolvable: 'UNRESOLVABLE',
    }

    const newStatus = statusMap[data.resolutionOutcome]

    // Atomic transaction for resolution
    await prisma.$transaction(async (tx) => {
      // 1. Update prediction status
      await tx.prediction.update({
        where: { id: params.id },
        data: {
          status: newStatus as 'RESOLVED_CORRECT' | 'RESOLVED_WRONG' | 'VOID' | 'UNRESOLVABLE',
          resolvedAt: new Date(),
          resolvedById: session.user.id,
          resolutionOutcome: data.resolutionOutcome,
          evidenceLinks: data.evidenceLinks,
          resolutionNote: data.resolutionNote,
        },
      })

      // 2. Mark correct option for MC predictions
      if (prediction.outcomeType === 'MULTIPLE_CHOICE' && data.correctOptionId) {
        await tx.predictionOption.updateMany({
          where: {
            predictionId: params.id,
            id: data.correctOptionId,
          },
          data: { isCorrect: true },
        })
        await tx.predictionOption.updateMany({
          where: {
            predictionId: params.id,
            id: { not: data.correctOptionId },
          },
          data: { isCorrect: false },
        })
      }

      // 3. Process each commitment based on outcome
      for (const commitment of prediction.commitments) {
        let cuReturned = 0
        let rsChange = 0

        // Determine if this commitment was correct
        let wasCorrect = false
        if (prediction.outcomeType === 'BINARY') {
          // For binary: correct = true means "will happen"
          // If resolved as correct, those who chose true win
          // If resolved as wrong, those who chose false win
          wasCorrect = (data.resolutionOutcome === 'correct' && commitment.binaryChoice === true) ||
                       (data.resolutionOutcome === 'wrong' && commitment.binaryChoice === false)
        } else if (prediction.outcomeType === 'MULTIPLE_CHOICE') {
          wasCorrect = commitment.optionId === data.correctOptionId
        }

        // CU and RS effects based on outcome
        switch (data.resolutionOutcome) {
          case 'correct':
          case 'wrong':
            // Unlock CU regardless of individual result
            cuReturned = commitment.cuCommitted
            // RS change would be calculated here (out of scope for now)
            // rsChange = calculateRsChange(commitment, wasCorrect)
            rsChange = wasCorrect ? 5 : -5 // Simplified: +5 for correct, -5 for wrong
            break
          case 'void':
            // Refund CU, no RS change
            cuReturned = commitment.cuCommitted
            rsChange = 0
            break
          case 'unresolvable':
            // Unlock CU, no RS change
            cuReturned = commitment.cuCommitted
            rsChange = 0
            break
        }

        // Update commitment record
        await tx.commitment.update({
          where: { id: commitment.id },
          data: {
            cuReturned,
            rsChange,
          },
        })

        // Update user balances
        await tx.user.update({
          where: { id: commitment.userId },
          data: {
            cuAvailable: { increment: cuReturned },
            cuLocked: { decrement: commitment.cuCommitted },
            rs: { increment: rsChange },
          },
        })

        // Create ledger entry
        const transactionType = data.resolutionOutcome === 'void' ? 'REFUND' : 'COMMITMENT_UNLOCK'
        await tx.cuTransaction.create({
          data: {
            userId: commitment.userId,
            type: transactionType,
            amount: cuReturned,
            referenceId: commitment.id,
            note: `Prediction resolved: ${data.resolutionOutcome}`,
            balanceAfter: 0, // Will be calculated in a real implementation
          },
        })
      }
    })

    // Fetch updated prediction
    const updatedPrediction = await prisma.prediction.findUnique({
      where: { id: params.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        newsAnchor: true,
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        commitments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                rs: true,
              },
            },
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    })

    return NextResponse.json(updatedPrediction)
  } catch (error) {
    console.error('Error resolving prediction:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to resolve prediction' },
      { status: 500 }
    )
  }
}

