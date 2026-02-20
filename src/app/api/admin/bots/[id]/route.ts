import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { handleRouteError, apiError } from '@/lib/api-error'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateBotSchema = z.object({
  personaPrompt: z.string().min(10).optional(),
  forecastPrompt: z.string().min(10).optional(),
  votePrompt: z.string().min(10).optional(),
  newsSources: z.array(z.string().url()).optional(),
  intervalMinutes: z.number().int().min(5).max(10080).optional(),
  maxForecastsPerDay: z.number().int().min(0).max(20).optional(),
  maxVotesPerDay: z.number().int().min(0).max(50).optional(),
  stakeMin: z.number().int().min(1).optional(),
  stakeMax: z.number().int().min(1).optional(),
  modelPreference: z.string().optional(),
  hotnessMinSources: z.number().int().min(1).optional(),
  hotnessWindowHours: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
})

// PATCH /api/admin/bots/[id] — update bot config
export const PATCH = withAuth(
  async (request: NextRequest, _user, { params }) => {
    try {
      const body = await request.json()
      const data = updateBotSchema.parse(body)

      const bot = await prisma.botConfig.findUnique({ where: { id: params.id } })
      if (!bot) return apiError('Bot not found', 404)

      // Validate stake range if both provided
      const newMin = data.stakeMin ?? bot.stakeMin
      const newMax = data.stakeMax ?? bot.stakeMax
      if (newMin > newMax) {
        return NextResponse.json({ error: 'stakeMin must be ≤ stakeMax' }, { status: 400 })
      }

      const updated = await prisma.botConfig.update({
        where: { id: params.id },
        data,
        include: { user: { select: { id: true, name: true, username: true, cuAvailable: true } } },
      })

      return NextResponse.json({ bot: updated })
    } catch (err) {
      return handleRouteError(err, 'Failed to update bot')
    }
  },
  { roles: ['ADMIN'] },
)

// DELETE /api/admin/bots/[id] — disable (soft delete via isActive = false)
export const DELETE = withAuth(
  async (_request: NextRequest, _user, { params }) => {
    try {
      const bot = await prisma.botConfig.findUnique({ where: { id: params.id } })
      if (!bot) return apiError('Bot not found', 404)

      await prisma.botConfig.update({
        where: { id: params.id },
        data: { isActive: false },
      })

      return NextResponse.json({ ok: true })
    } catch (err) {
      return handleRouteError(err, 'Failed to disable bot')
    }
  },
  { roles: ['ADMIN'] },
)
