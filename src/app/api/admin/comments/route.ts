import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/comments — list comments for moderation
export async function GET(request: NextRequest) {
  const auth = await requireRole('adminOrModerator')
  if ('error' in auth) return auth.error

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const showDeleted = searchParams.get('showDeleted') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (search) {
    where.text = { contains: search, mode: 'insensitive' }
  }

  if (!showDeleted) {
    where.deletedAt = null
  }

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      select: {
        id: true,
        text: true,
        createdAt: true,
        deletedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        prediction: {
          select: { id: true, claimText: true },
        },
        forecast: {
          select: { id: true, title: true },
        },
        _count: {
          select: { replies: true, reactions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.comment.count({ where }),
  ])

  return NextResponse.json({ comments, total, page, limit })
}
