import { NextResponse } from 'next/server'
import { updateCommentSchema } from '@/lib/validations/comment'
import { apiError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// PATCH /api/comments/[id] - Update comment
export const PATCH = withAuth(async (request, user, { params }) => {
  const comment = await prisma.comment.findUnique({
    where: { id: params.id },
  })

  if (!comment || comment.deletedAt) {
    return apiError('Comment not found', 404)
  }

  // Only author can edit
  if (comment.authorId !== user.id) {
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
})

// DELETE /api/comments/[id] - Soft delete comment
export const DELETE = withAuth(async (_request, user, { params }) => {
  const comment = await prisma.comment.findUnique({
    where: { id: params.id },
  })

  if (!comment || comment.deletedAt) {
    return apiError('Comment not found', 404)
  }

  // Only author, admin, or resolver can delete
  const canDelete = 
    comment.authorId === user.id || 
    user.role === 'ADMIN' || 
    user.role === 'RESOLVER'

  if (!canDelete) {
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
})
