import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/forecasts — list predictions with admin controls
export async function GET(request: NextRequest) {
  const auth = await requireRole('adminOrModerator')
  if ('error' in auth) return auth.error

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (search) {
    where.claimText = { contains: search, mode: 'insensitive' }
  }

  if (status) {
    where.status = status
  }

  const [predictions, total] = await Promise.all([
    prisma.prediction.findMany({
      where,
      select: {
        id: true,
        claimText: true,
        slug: true,
        domain: true,
        status: true,
        outcomeType: true,
        resolveByDatetime: true,
        createdAt: true,
        publishedAt: true,
        resolvedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
        _count: {
          select: {
            commitments: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.prediction.count({ where }),
  ])

  return NextResponse.json({ predictions, total, page, limit })
}
