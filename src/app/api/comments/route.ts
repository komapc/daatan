import { NextRequest, NextResponse } from 'next/server'
import { createCommentSchema, listCommentsQuerySchema } from '@/lib/validations/comment'
import { apiError, handleRouteError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { notifyNewComment } from '@/lib/services/telegram'
import { createNotification } from '@/lib/services/notification'

export const dynamic = 'force-dynamic'

// GET /api/comments - List comments (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const query = listCommentsQuerySchema.parse({
      predictionId: searchParams.get('predictionId') || undefined,
      parentId: searchParams.get('parentId') || undefined,
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 50,
    })

    const where: Record<string, unknown> = {
      deletedAt: null, // Only show non-deleted comments
    }

    if (query.predictionId) where.predictionId = query.predictionId
    if (query.parentId) {
      where.parentId = query.parentId
    } else {
      // If no parentId specified, only show top-level comments
      where.parentId = null
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            rs: true,
            role: true,
          },
        },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                },
              },
            },
          },
          _count: {
            select: { replies: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.comment.count({ where }),
    ])

    return NextResponse.json({
      comments,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch comments')
  }
}

// POST /api/comments - Create a new comment
export const POST = withAuth(async (request, user) => {
  const body = await request.json()
  const data = createCommentSchema.parse(body)

  // Verify the prediction exists
  let prediction: { id: string; claimText: string; authorId: string; slug: string | null } | null = null
  prediction = await prisma.prediction.findUnique({
    where: { id: data.predictionId },
    select: { id: true, claimText: true, authorId: true, slug: true },
  })
  if (!prediction) {
    return apiError('Prediction not found', 404)
  }

  // Verify parent comment exists if specified
  let parentComment: { id: string; authorId: string; deletedAt: Date | null } | null = null
  if (data.parentId) {
    parentComment = await prisma.comment.findUnique({
      where: { id: data.parentId },
      select: { id: true, authorId: true, deletedAt: true },
    })
    if (!parentComment || parentComment.deletedAt) {
      return apiError('Parent comment not found', 404)
    }
  }

  const comment = await prisma.comment.create({
    data: {
      authorId: user.id,
      text: data.text,
      predictionId: data.predictionId,
      parentId: data.parentId,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
          rs: true,
          role: true,
        },
      },
      reactions: true,
      _count: {
        select: { replies: true },
      },
    },
  })

  notifyNewComment(prediction, comment.author, data.text)

  // Notify forecast author about new comment
  const forecastLink = `/forecasts/${prediction.slug || prediction.id}`
  createNotification({
    userId: prediction.authorId,
    type: 'COMMENT_ON_FORECAST',
    title: 'New comment on your forecast',
    message: `${comment.author.name || comment.author.username || 'Someone'} commented on "${prediction.claimText.substring(0, 80)}"`,
    link: forecastLink,
    predictionId: prediction.id,
    commentId: comment.id,
    actorId: user.id,
  })

  // Notify parent comment author about reply
  if (data.parentId && parentComment) {
    createNotification({
      userId: parentComment.authorId,
      type: 'REPLY_TO_COMMENT',
      title: 'New reply to your comment',
      message: `${comment.author.name || comment.author.username || 'Someone'} replied to your comment`,
      link: forecastLink,
      predictionId: prediction.id,
      commentId: comment.id,
      actorId: user.id,
    })
  }

  return NextResponse.json(comment, { status: 201 })
})
