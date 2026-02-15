import { NextResponse } from 'next/server'
import { addReactionSchema } from '@/lib/validations/comment'
import { apiError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/comments/[id]/react - Add or update reaction
export const POST = withAuth(async (request, user, { params }) => {
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
        userId: user.id,
        commentId: params.id,
      },
    },
    update: {
      type: data.type,
    },
    create: {
      userId: user.id,
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
})

// DELETE /api/comments/[id]/react - Remove reaction
export const DELETE = withAuth(async (_request, user, { params }) => {
  await prisma.commentReaction.deleteMany({
    where: {
      userId: user.id,
      commentId: params.id,
    },
  })

  return NextResponse.json({ success: true })
})
