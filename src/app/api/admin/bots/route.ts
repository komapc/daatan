import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { handleRouteError } from '@/lib/api-error'
import { z } from 'zod'
import { createBotLLMService } from '@/lib/llm'
import { botConfigGenerationSchema } from '@/lib/llm/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('admin-bots')

export const dynamic = 'force-dynamic'

const DEFAULT_PERSONA = 'You are a curious analyst who follows world news and enjoys making predictions about future events.'
const DEFAULT_FORECAST_PROMPT = 'Based on the news topic provided, create a specific and verifiable forecast. Be realistic about timeframes.'
const DEFAULT_VOTE_PROMPT = 'Based on your interests and the available forecasts, decide whether to commit to each one.'

const createBotSchema = z
  .object({
    name: z.string().min(2).max(50),
    personaPrompt: z.string().min(10).default(DEFAULT_PERSONA),
    forecastPrompt: z.string().min(10).default(DEFAULT_FORECAST_PROMPT),
    votePrompt: z.string().min(10).default(DEFAULT_VOTE_PROMPT),
    newsSources: z.array(z.string()).default([]),
    intervalMinutes: z.number().int().min(5).max(10080).default(360),
    maxForecastsPerDay: z.number().int().min(0).max(20).default(3),
    maxVotesPerDay: z.number().int().min(0).max(50).default(10),
    stakeMin: z.number().int().min(1).default(10),
    stakeMax: z.number().int().min(1).default(100),
    modelPreference: z.string().default('google/gemini-2.0-flash-exp:free'),
    hotnessMinSources: z.number().int().min(1).default(2),
    hotnessWindowHours: z.number().int().min(1).default(6),
    // Extended params (Stage 1 — stored only; wired in bot-runner in Stage 2)
    activeHoursStart: z.number().int().min(0).max(23).nullable().default(null),
    activeHoursEnd: z.number().int().min(0).max(23).nullable().default(null),
    tagFilter: z.array(z.string().min(1)).default([]),
    voteBias: z.number().int().min(0).max(100).default(50),
    cuRefillAt: z.number().int().min(0).default(0),
    cuRefillAmount: z.number().int().min(1).default(50),
    canCreateForecasts: z.boolean().default(true),
    canVote: z.boolean().default(true),
  })
  .refine((d) => (d.activeHoursStart == null) === (d.activeHoursEnd == null), {
    message: 'activeHoursStart and activeHoursEnd must both be set or both be null',
    path: ['activeHoursStart'],
  })

// GET /api/admin/bots — list all bots
export const GET = withAuth(
  async () => {
    try {
      const bots = await prisma.botConfig.findMany({
        select: {
          id: true,
          userId: true,
          personaPrompt: true,
          forecastPrompt: true,
          votePrompt: true,
          newsSources: true,
          intervalMinutes: true,
          maxForecastsPerDay: true,
          maxVotesPerDay: true,
          stakeMin: true,
          stakeMax: true,
          modelPreference: true,
          hotnessMinSources: true,
          hotnessWindowHours: true,
          activeHoursStart: true,
          activeHoursEnd: true,
          tagFilter: true,
          voteBias: true,
          cuRefillAt: true,
          cuRefillAmount: true,
          canCreateForecasts: true,
          canVote: true,
          autoApprove: true,
          isActive: true,
          lastRunAt: true,
          createdAt: true,
          user: { select: { id: true, name: true, username: true, image: true, cuAvailable: true, cuLocked: true } },
          runLogs: { orderBy: { runAt: 'desc' }, take: 1, select: { runAt: true, action: true, error: true } },
        },
        orderBy: { createdAt: 'asc' },
      })

      // Attach today's action counts — single groupBy instead of 2×N count queries
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const botIds = bots.map(b => b.id)
      const todayCounts = await prisma.botRunLog.groupBy({
        by: ['botId', 'action'],
        where: {
          botId: { in: botIds },
          action: { in: ['CREATED_FORECAST', 'VOTED'] },
          isDryRun: false,
          runAt: { gte: startOfDay },
        },
        _count: { _all: true },
      })

      const countsByBot = new Map<string, { forecastsToday: number; votesToday: number }>()
      for (const row of todayCounts) {
        const entry = countsByBot.get(row.botId) ?? { forecastsToday: 0, votesToday: 0 }
        if (row.action === 'CREATED_FORECAST') entry.forecastsToday = row._count._all
        if (row.action === 'VOTED') entry.votesToday = row._count._all
        countsByBot.set(row.botId, entry)
      }

      const enriched = bots.map((bot) => {
          const { forecastsToday, votesToday } = countsByBot.get(bot.id) ?? { forecastsToday: 0, votesToday: 0 }

          const nextRunAt = bot.lastRunAt
            ? new Date(bot.lastRunAt.getTime() + bot.intervalMinutes * 60 * 1000)
            : null

          return {
            id: bot.id,
            isActive: bot.isActive,
            intervalMinutes: bot.intervalMinutes,
            maxForecastsPerDay: bot.maxForecastsPerDay,
            maxVotesPerDay: bot.maxVotesPerDay,
            stakeMin: bot.stakeMin,
            stakeMax: bot.stakeMax,
            modelPreference: bot.modelPreference,
            hotnessMinSources: bot.hotnessMinSources,
            hotnessWindowHours: bot.hotnessWindowHours,
            personaPrompt: bot.personaPrompt,
            forecastPrompt: bot.forecastPrompt,
            votePrompt: bot.votePrompt,
            newsSources: bot.newsSources,
            activeHoursStart: bot.activeHoursStart,
            activeHoursEnd: bot.activeHoursEnd,
            tagFilter: bot.tagFilter,
            voteBias: bot.voteBias,
            cuRefillAt: bot.cuRefillAt,
            cuRefillAmount: bot.cuRefillAmount,
            canCreateForecasts: bot.canCreateForecasts,
            canVote: bot.canVote,
            autoApprove: bot.autoApprove,
            lastRunAt: bot.lastRunAt,
            nextRunAt,
            forecastsToday,
            votesToday,
            lastLog: bot.runLogs[0] || null,
            user: bot.user,
          }
        })

      return NextResponse.json({ bots: enriched })
    } catch (err) {
      return handleRouteError(err, 'Failed to list bots')
    }
  },
  { roles: ['ADMIN'] },
)

// POST /api/admin/bots — create a new bot
export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json()
      const data = createBotSchema.parse(body)

      // Validate stakeMin <= stakeMax
      if (data.stakeMin > data.stakeMax) {
        return NextResponse.json({ error: 'stakeMin must be ≤ stakeMax' }, { status: 400 })
      }

      // Build username with _b suffix
      const username = `${data.name.toLowerCase().replace(/\s+/g, '_')}_b`

      // Check username uniqueness
      const existing = await prisma.user.findUnique({ where: { username } })
      if (existing) {
        return NextResponse.json({ error: `Username ${username} is already taken` }, { status: 400 })
      }

      // If prompts are default, dynamically generate them based on the bot's name
      if (data.personaPrompt === DEFAULT_PERSONA) {
        try {
          const llm = createBotLLMService(data.modelPreference)
          const prompt = `You are defining a new autonomous agent for a prediction market platform. 
The bot's name is "${data.name}". 

Based on this name, infer what kind of topics it cares about, its personality, and what news sources it should read.
Generate a JSON object with:
- personaPrompt: "You are [Name], a [description]. You track [topics]."
- forecastPrompt: "Using the news topic, write a specific, verifiable forecast about [topics]. Avoid vague claims. Resolution window: 14-90 days."
- votePrompt: "As a [role], commit to forecasts about [topics]. Vote yes when [conditions]."
- newsSources: An array of 2-4 real world RSS feed URLs that fit this persona (e.g., https://feeds.bbci.co.uk/news/world/rss.xml, https://www.theverge.com/rss/index.xml, etc).

Make the prompts highly specific, opinionated, and sharp. Do not be generic.`

          const generatedSchema = z.object({
            personaPrompt: z.string().min(10),
            forecastPrompt: z.string().min(10),
            votePrompt: z.string().min(10),
            newsSources: z.array(z.string()).default([]),
          })

          const response = await llm.generateContent({ prompt, temperature: 0.7, schema: botConfigGenerationSchema })
          const parsed = generatedSchema.safeParse(JSON.parse(response.text))
          if (parsed.success) {
            data.personaPrompt = parsed.data.personaPrompt
            data.forecastPrompt = parsed.data.forecastPrompt
            data.votePrompt = parsed.data.votePrompt
            data.newsSources = parsed.data.newsSources
          } else {
            log.warn({ issues: parsed.error.issues }, 'LLM-generated bot config failed validation, using defaults')
          }
        } catch (llmErr) {
          log.error({ err: llmErr }, 'Failed to generate dynamic bot prompts, using defaults')
        }
      }

      // Create bot user + config in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: `${username}@daatan.internal`,
            name: data.name,
            username,
            slug: username,
            isBot: true,
            emailNotifications: false,
            isPublic: true,
            // Same starting balance as regular users (100 CU from initial grant)
            cuAvailable: 100,
          },
        })

        const botConfig = await tx.botConfig.create({
          data: {
            userId: user.id,
            personaPrompt: data.personaPrompt,
            forecastPrompt: data.forecastPrompt,
            votePrompt: data.votePrompt,
            newsSources: data.newsSources,
            intervalMinutes: data.intervalMinutes,
            maxForecastsPerDay: data.maxForecastsPerDay,
            maxVotesPerDay: data.maxVotesPerDay,
            stakeMin: data.stakeMin,
            stakeMax: data.stakeMax,
            modelPreference: data.modelPreference,
            hotnessMinSources: data.hotnessMinSources,
            hotnessWindowHours: data.hotnessWindowHours,
            activeHoursStart: data.activeHoursStart,
            activeHoursEnd: data.activeHoursEnd,
            tagFilter: data.tagFilter,
            voteBias: data.voteBias,
            cuRefillAt: data.cuRefillAt,
            cuRefillAmount: data.cuRefillAmount,
            canCreateForecasts: data.canCreateForecasts,
            canVote: data.canVote,
          },
          include: { user: true },
        })

        return botConfig
      })

      return NextResponse.json({ bot: result }, { status: 201 })
    } catch (err) {
      return handleRouteError(err, 'Failed to create bot')
    }
  },
  { roles: ['ADMIN'] },
)
