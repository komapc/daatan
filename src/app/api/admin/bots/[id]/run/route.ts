import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { runBotById } from '@/lib/services/bot-runner'
import { apiError, handleRouteError } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/admin/bots/[id]/run?dry=true — manual trigger (with optional dry run)
export const POST = withAuth(
  async (request: NextRequest, _user, { params }) => {
    try {
      const bot = await prisma.botConfig.findUnique({ where: { id: params.id } })
      if (!bot) return apiError('Bot not found', 404)

      const dryRun = new URL(request.url).searchParams.get('dry') === 'true'
      const summary = await runBotById(params.id, dryRun)

      return NextResponse.json({ ok: true, summary })
    } catch (err) {
      return handleRouteError(err, 'Failed to run bot')
    }
  },
  { roles: ['ADMIN'] },
)
