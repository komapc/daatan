import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addReactionSchema } from '@/lib/validations/comment'
import { apiError, handleRouteError } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/comments/[id]/react - Add or update reaction
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
    })

    if (!comment || comment.deletedAt) {
      return apiError('Comment not found', 404)
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
    return handleRouteError(error, 'Failed to add reaction')
  }
}

// DELETE /api/comments/[id]/react - Remove reaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    await prisma.commentReaction.deleteMany({
      where: {
        userId: session.user.id,
        commentId: params.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to remove reaction')
  }
}
