import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { apiError, handleRouteError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

// GET /api/admin/bots/[id]/logs?page=1&limit=20 — paginated run log
export const GET = withAuth(
  async (request: NextRequest, _user, { params }) => {
    try {
      const bot = await prisma.botConfig.findUnique({ where: { id: params.id } })
      if (!bot) return apiError('Bot not found', 404)

      const { searchParams } = new URL(request.url)
      const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
      const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))

      const [logs, total] = await Promise.all([
        prisma.botRunLog.findMany({
          where: { botId: params.id },
          orderBy: { runAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.botRunLog.count({ where: { botId: params.id } }),
      ])

      return NextResponse.json({
        logs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      return handleRouteError(err, 'Failed to fetch bot logs')
    }
  },
  { roles: ['ADMIN'] },
)
