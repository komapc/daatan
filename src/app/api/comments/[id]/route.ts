import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateCommentSchema } from '@/lib/validations/comment'
import { apiError, handleRouteError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// PATCH /api/comments/[id] - Update comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prisma = await getPrisma()
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

    // Only author can edit
    if (comment.authorId !== session.user.id) {
      return apiError('Forbidden', 403)
    }

    const body = await request.json()
    const data = updateCommentSchema.parse(body)

    const updated = await prisma.comment.update({
      where: { id: params.id },
      data: {
        text: data.text,
        updatedAt: new Date(),
      },
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
        reactions: true,
        _count: {
          select: { replies: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error, 'Failed to update comment')
  }
}

// DELETE /api/comments/[id] - Soft delete comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prisma = await getPrisma()
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

    // Only author, admin, or moderator can delete
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true, isModerator: true },
    })

    if (comment.authorId !== session.user.id && !user?.isAdmin && !user?.isModerator) {
      return apiError('Forbidden', 403)
    }

    // Soft delete
    await prisma.comment.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to delete comment')
  }
}
