import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updatePredictionSchema } from '@/lib/validations/prediction'

export const dynamic = 'force-dynamic'

const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

type RouteParams = {
  params: { id: string }
}

// GET /api/predictions/[id] - Get a single prediction
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const prediction = await prisma.prediction.findUnique({
      where: { id: params.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            rs: true,
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
                image: true,
                rs: true,
              },
            },
            option: {
              select: {
                id: true,
                text: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        _count: {
          select: { commitments: true },
        },
      },
    })

    if (!prediction) {
      return NextResponse.json(
        { error: 'Prediction not found' },
        { status: 404 }
      )
    }

    // Calculate total CU committed
    const totalCuCommitted = prediction.commitments.reduce(
      (sum, c) => sum + c.cuCommitted,
      0
    )

    return NextResponse.json({
      ...prediction,
      totalCuCommitted,
    })
  } catch (error) {
    console.error('Error fetching prediction:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prediction' },
      { status: 500 }
    )
  }
}

// PATCH /api/predictions/[id] - Update a prediction (draft only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const prediction = await prisma.prediction.findUnique({
      where: { id: params.id },
      select: { authorId: true, status: true },
    })

    if (!prediction) {
      return NextResponse.json(
        { error: 'Prediction not found' },
        { status: 404 }
      )
    }

    // Only author can update
    if (prediction.authorId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Can only update drafts
    if (prediction.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Cannot update published predictions' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const data = updatePredictionSchema.parse(body)

    // Validate resolve-by if provided
    if (data.resolveByDatetime && new Date(data.resolveByDatetime) <= new Date()) {
      return NextResponse.json(
        { error: 'Resolution date must be in the future' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (data.claimText) updateData.claimText = data.claimText
    if (data.detailsText !== undefined) updateData.detailsText = data.detailsText
    if (data.domain !== undefined) updateData.domain = data.domain
    if (data.outcomePayload) updateData.outcomePayload = data.outcomePayload
    if (data.resolutionRules !== undefined) updateData.resolutionRules = data.resolutionRules
    if (data.resolveByDatetime) updateData.resolveByDatetime = new Date(data.resolveByDatetime)

    const updated = await prisma.prediction.update({
      where: { id: params.id },
      data: updateData,
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
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating prediction:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update prediction' },
      { status: 500 }
    )
  }
}

// DELETE /api/predictions/[id] - Delete a prediction (draft only)
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

    const prediction = await prisma.prediction.findUnique({
      where: { id: params.id },
      select: { authorId: true, status: true },
    })

    if (!prediction) {
      return NextResponse.json(
        { error: 'Prediction not found' },
        { status: 404 }
      )
    }

    if (prediction.authorId !== session.user.id && !session.user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    if (prediction.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only delete draft predictions' },
        { status: 400 }
      )
    }

    await prisma.prediction.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting prediction:', error)
    return NextResponse.json(
      { error: 'Failed to delete prediction' },
      { status: 500 }
    )
  }
}

