import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createPredictionSchema, listPredictionsQuerySchema } from '@/lib/validations/prediction'

export const dynamic = 'force-dynamic'

const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// GET /api/predictions - List predictions
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    
    const query = listPredictionsQuerySchema.parse({
      status: searchParams.get('status') || undefined,
      authorId: searchParams.get('authorId') || undefined,
      domain: searchParams.get('domain') || undefined,
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 20,
    })

    const resolvedOnly = searchParams.get('resolvedOnly') === 'true'
    const closingSoon = searchParams.get('closingSoon') === 'true'

    const where: Record<string, unknown> = {}
    
    // Handle resolved filter
    if (resolvedOnly) {
      where.status = { in: ['RESOLVED_CORRECT', 'RESOLVED_WRONG'] }
    } else if (query.status) {
      where.status = query.status
    }
    
    if (query.authorId) where.authorId = query.authorId
    if (query.domain) where.domain = query.domain
    
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
          options: {
            orderBy: { displayOrder: 'asc' },
          },
          _count: {
            select: { commitments: true },
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

    return NextResponse.json({
      predictions,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    })
  } catch (error) {
    console.error('Error fetching predictions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    )
  }
}

// POST /api/predictions - Create a new prediction (draft)
export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const data = createPredictionSchema.parse(body)

    // Validate resolve-by is in the future
    if (new Date(data.resolveByDatetime) <= new Date()) {
      return NextResponse.json(
        { error: 'Resolution date must be in the future' },
        { status: 400 }
      )
    }

    // Auto-create news anchor from URL if no newsAnchorId provided
    let newsAnchorId = data.newsAnchorId
    if (!newsAnchorId && data.newsAnchorUrl) {
      const crypto = await import('crypto')
      const urlHash = crypto.createHash('sha256').update(data.newsAnchorUrl).digest('hex')
      
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
        authorId: session.user.id,
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
  } catch (error) {
    console.error('Error creating prediction:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create prediction' },
      { status: 500 }
    )
  }
}

