import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addReactionSchema } from '@/lib/validations/comment'

export const dynamic = 'force-dynamic'

const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// POST /api/comments/[id]/react - Add or update reaction
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
    })

    if (!comment || comment.deletedAt) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = addReactionSchema.parse(body)

    // Upsert reaction (update if exists, create if not)
    const reaction = await prisma.commentReaction.upsert({
      where: {
        userId_commentId: {
          userId: session.user.id,
          commentId: params.id,
        },
      },
      update: {
        type: data.type,
      },
      create: {
        userId: session.user.id,
        commentId: params.id,
        type: data.type,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    })

    return NextResponse.json(reaction)
  } catch (error) {
    console.error('Error adding reaction:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to add reaction' },
      { status: 500 }
    )
  }
}

// DELETE /api/comments/[id]/react - Remove reaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    await prisma.commentReaction.deleteMany({
      where: {
        userId: session.user.id,
        commentId: params.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing reaction:', error)
    return NextResponse.json(
      { error: 'Failed to remove reaction' },
      { status: 500 }
    )
  }
}
