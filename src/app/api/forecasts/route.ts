import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createPredictionSchema, listPredictionsQuerySchema } from '@/lib/validations/prediction'
import { apiError, handleRouteError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { transitionExpiredPredictions } from '@/lib/services/prediction-lifecycle'
import { hashUrl } from '@/lib/utils/hash'

export const dynamic = 'force-dynamic'

// GET /api/predictions - List predictions (public, with optional session for user context)
export async function GET(request: NextRequest) {
  try {
    // Transition any ACTIVE predictions past their deadline to PENDING
    await transitionExpiredPredictions()

    const { searchParams } = new URL(request.url)

    const query = listPredictionsQuerySchema.parse({
      status: searchParams.get('status') || undefined,
      authorId: searchParams.get('authorId') || undefined,
      domain: searchParams.get('domain') || undefined,
      tags: searchParams.get('tags') || undefined,
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 20,
    })

    const resolvedOnly = searchParams.get('resolvedOnly') === 'true'
    const closingSoon = searchParams.get('closingSoon') === 'true'

    const where: Record<string, unknown> = {}

    // Handle resolved filter
    if (resolvedOnly) {
      where.status = { in: ['RESOLVED_CORRECT', 'RESOLVED_WRONG', 'VOID', 'UNRESOLVABLE'] }
    } else if (query.status) {
      where.status = query.status
    }

    if (query.authorId) where.authorId = query.authorId
    if (query.domain) where.domain = query.domain

    // Filter by tags (comma-separated, match predictions that have ANY of the selected tags)
    if (query.tags) {
      const tagNames = query.tags.split(',').map(t => t.trim()).filter(Boolean)
      if (tagNames.length > 0) {
        where.tags = {
          some: {
            name: { in: tagNames },
          },
        }
      }
    }

    // Don't show drafts unless filtering by authorId
    if (!query.authorId && !query.status && !resolvedOnly) {
      where.status = { not: 'DRAFT' }
    }

    // Handle "closing soon" filter (within 7 days)
    if (closingSoon && query.status === 'ACTIVE') {
      const sevenDaysFromNow = new Date()
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
      where.resolveByDatetime = {
        lte: sevenDaysFromNow,
        gte: new Date(),
      }
    }

    const [predictions, total] = await Promise.all([
      prisma.prediction.findMany({
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
          newsAnchor: {
            select: {
              id: true,
              title: true,
              url: true,
              source: true,
              imageUrl: true,
            },
          },
          tags: {
            select: { name: true },
          },
          options: {
            orderBy: { displayOrder: 'asc' },
          },
          _count: {
            select: { commitments: true },
          },
          commitments: {
            select: {
              cuCommitted: true,
              userId: true,
            },
          },
        },
        orderBy: closingSoon
          ? { resolveByDatetime: 'asc' }
          : { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.prediction.count({ where }),
    ])

    // Get current user ID for commitment indicator (guard: session can throw on malformed cookie)
    let userId: string | undefined
    try {
      const session = await getServerSession(authOptions)
      userId = session?.user?.id
    } catch {
      userId = undefined
    }

    // Transform predictions to include totalCuCommitted and userHasCommitted
    const enrichedPredictions = predictions.map(({ commitments, ...pred }) => ({
      ...pred,
      totalCuCommitted: commitments.reduce((sum, c) => sum + c.cuCommitted, 0),
      userHasCommitted: userId ? commitments.some(c => c.userId === userId) : false,
    }))

    return NextResponse.json({
      predictions: enrichedPredictions,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch predictions')
  }
}

// POST /api/predictions - Create a new prediction (draft)
export const POST = withAuth(async (request, user) => {
  const body = await request.json()
  const data = createPredictionSchema.parse(body)

  // Verify user exists in database (JWT may reference a deleted/missing user)
  const userExists = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true },
  })
  if (!userExists) {
    return apiError('User not found. Please sign out and sign back in.', 403)
  }

  // Validate resolve-by is in the future
  if (new Date(data.resolveByDatetime) <= new Date()) {
    return apiError('Resolution date must be in the future', 400)
  }

  // Auto-create news anchor from URL if no newsAnchorId provided
  let newsAnchorId = data.newsAnchorId
  if (!newsAnchorId && data.newsAnchorUrl) {
    const urlHash = hashUrl(data.newsAnchorUrl)

    // Upsert: find existing or create new
    const anchor = await prisma.newsAnchor.upsert({
      where: { urlHash },
      update: {},
      create: {
        url: data.newsAnchorUrl,
        urlHash,
        title: data.newsAnchorTitle || data.newsAnchorUrl,
        source: data.newsAnchorUrl ? new URL(data.newsAnchorUrl).hostname.replace('www.', '') : undefined,
      },
    })
    newsAnchorId = anchor.id
  }

  // Build outcome payload based on type
  let outcomePayload: Record<string, unknown> = data.outcomePayload ?? {}
  if (data.outcomeType === 'BINARY' && Object.keys(outcomePayload).length === 0) {
    outcomePayload = { type: 'BINARY' }
  }

  // Generate slug from claim text
  const { slugify, generateUniqueSlug } = await import('@/lib/utils/slugify')
  const baseSlug = slugify(data.claimText)

  // Check for existing slugs
  const existingPredictions = await prisma.prediction.findMany({
    where: {
      slug: {
        startsWith: baseSlug,
      },
    },
    select: { slug: true },
  })

  const existingSlugs = existingPredictions
    .map(p => p.slug)
    .filter((s): s is string => s !== null)

  const uniqueSlug = generateUniqueSlug(baseSlug, existingSlugs)

  // Create prediction
  const prediction = await prisma.prediction.create({
    data: {
      authorId: user.id,
      newsAnchorId: newsAnchorId,
      claimText: data.claimText,
      slug: uniqueSlug,
      detailsText: data.detailsText,
      domain: data.domain,
      outcomeType: data.outcomeType,
      outcomePayload: outcomePayload as object,
      resolutionRules: data.resolutionRules,
      resolveByDatetime: new Date(data.resolveByDatetime),
      status: 'DRAFT',
      // Connect or create tags
      tags: data.tags?.length
        ? {
          connectOrCreate: await Promise.all(
            data.tags.map(async (tagName) => {
              const tagSlug = slugify(tagName)
              return {
                where: { slug: tagSlug },
                create: {
                  name: tagName,
                  slug: tagSlug,
                },
              }
            })
          ),
        }
        : undefined,
    },
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
      options: true,
      tags: true,
    },
  })

  // Create options for multiple choice
  if (data.outcomeType === 'MULTIPLE_CHOICE' && data.outcomePayload) {
    const payload = data.outcomePayload as { options?: string[] }
    if (payload.options && Array.isArray(payload.options)) {
      await prisma.predictionOption.createMany({
        data: payload.options.map((text, index) => ({
          predictionId: prediction.id,
          text,
          displayOrder: index,
        })),
      })
    }
  }

  // Fetch with options
  const result = await prisma.prediction.findUnique({
    where: { id: prediction.id },
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

  return NextResponse.json(result, { status: 201 })
})
