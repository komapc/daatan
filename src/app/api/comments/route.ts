import { NextRequest, NextResponse } from 'next/server'
import { createCommentSchema, listCommentsQuerySchema } from '@/lib/validations/comment'
import { apiError, handleRouteError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { notifyNewComment } from '@/lib/services/telegram'

export const dynamic = 'force-dynamic'

// GET /api/comments - List comments (public)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const query = listCommentsQuerySchema.parse({
      predictionId: searchParams.get('predictionId') || undefined,
      forecastId: searchParams.get('forecastId') || undefined,
      parentId: searchParams.get('parentId') || undefined,
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 50,
    })

    const where: Record<string, unknown> = {
      deletedAt: null, // Only show non-deleted comments
    }
    
    if (query.predictionId) where.predictionId = query.predictionId
    if (query.forecastId) where.forecastId = query.forecastId
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

  // Verify the target exists
  let prediction: { id: string; claimText: string } | null = null
  if (data.predictionId) {
    prediction = await prisma.prediction.findUnique({
      where: { id: data.predictionId },
      select: { id: true, claimText: true },
    })
    if (!prediction) {
      return apiError('Prediction not found', 404)
    }
  }

  if (data.forecastId) {
    const forecast = await prisma.forecast.findUnique({
      where: { id: data.forecastId },
    })
    if (!forecast) {
      return apiError('Forecast not found', 404)
    }
  }

  // Verify parent comment exists if specified
  if (data.parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: data.parentId },
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
      forecastId: data.forecastId,
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

  if (prediction) {
    notifyNewComment(prediction, comment.author, data.text)
  }

  return NextResponse.json(comment, { status: 201 })
})
