import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createNewsAnchorSchema } from '@/lib/validations/prediction'
import { createHash } from 'crypto'
import { apiError, handleRouteError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// Generate URL hash for deduplication
const hashUrl = (url: string): string => {
  // Normalize URL before hashing
  const normalized = url.toLowerCase().replace(/\/$/, '').replace(/^https?:\/\//, '')
  return createHash('sha256').update(normalized).digest('hex')
}

// GET /api/news-anchors - Search/list news anchors
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma()
    const { searchParams } = new URL(request.url)
    
    const url = searchParams.get('url')
    const domain = searchParams.get('domain')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    // Find by exact URL
    if (url) {
      const urlHash = hashUrl(url)
      where.urlHash = urlHash
    }

    // Filter by domain
    if (domain) {
      where.domain = domain
    }

    // Search in title
    if (search) {
      where.title = { contains: search, mode: 'insensitive' }
    }

    const anchors = await prisma.newsAnchor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        _count: {
          select: { predictions: true },
        },
      },
    })

    return NextResponse.json({ anchors })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch news anchors')
  }
}

// POST /api/news-anchors - Create or get existing news anchor
export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const body = await request.json()
    const data = createNewsAnchorSchema.parse(body)

    const urlHash = hashUrl(data.url)

    // Check if anchor already exists (deduplication)
    const existing = await prisma.newsAnchor.findUnique({
      where: { urlHash },
      include: {
        _count: {
          select: { predictions: true },
        },
      },
    })

    if (existing) {
      // Return existing anchor
      return NextResponse.json({
        ...existing,
        isExisting: true,
      })
    }

    // Create new anchor
    const anchor = await prisma.newsAnchor.create({
      data: {
        url: data.url,
        urlHash,
        title: data.title,
        source: data.source,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        snippet: data.snippet,
        imageUrl: data.imageUrl,
        domain: data.domain,
      },
      include: {
        _count: {
          select: { predictions: true },
        },
      },
    })

    return NextResponse.json({
      ...anchor,
      isExisting: false,
    }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to create news anchor')
  }
}

