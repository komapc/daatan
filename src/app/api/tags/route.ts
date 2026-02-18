import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import { apiError, handleRouteError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

// GET /api/tags - List all tags with usage counts
export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: {
          select: {
            predictions: true,
          },
        },
      },
      orderBy: [
        { predictions: { _count: 'desc' } },
        { name: 'asc' },
      ],
    })

    return NextResponse.json({
      tags: tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        count: tag._count.predictions,
      })),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch tags')
  }
}

// POST /api/tags - Create a new tag (admin only)
export const POST = withAuth(async (request, user) => {
  // Only admins can create tags
  if (user.role !== 'ADMIN') {
    return apiError('Forbidden: Only admins can create tags', 403)
  }

  try {
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiError('Tag name is required', 400)
    }

    if (name.length > 50) {
      return apiError('Tag name must be 50 characters or less', 400)
    }

    // Import slugify utility
    const { slugify } = await import('@/lib/utils/slugify')
    const slug = slugify(name)

    // Check if tag already exists
    const existingTag = await prisma.tag.findUnique({
      where: { slug },
    })

    if (existingTag) {
      return apiError('Tag with this name already exists', 409)
    }

    // Create the tag
    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        slug,
      },
    })

    return NextResponse.json({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to create tag')
  }
})
