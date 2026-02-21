/**
 * Bot runner service.
 *
 * Called by /api/bots/run on a schedule (GitHub Actions every 5 minutes).
 * For each active bot that is "due", it:
 *   1. Fetches RSS feeds configured for the bot
 *   2. Detects hot topics (appearing in multiple sources)
 *   3. Deduplicates against existing forecast titles (LLM-based)
 *   4. Generates and posts a new forecast (with 🤖 in title)
 *   5. Stakes on the forecast immediately
 *   6. Optionally votes on existing open forecasts
 *   7. Logs all actions to BotRunLog
 *
 * Extended params wired here (Stage 2):
 *   - activeHoursStart/End: UTC hour window gate at top of runBot()
 *   - canCreateForecasts / canVote: phase enable flags
 *   - tagFilter: prompt injection for creation; DB filter for voting
 *   - voteBias: soft prompt hint in vote decision
 *   - cuRefillAt / cuRefillAmount: ADMIN_GRANT auto top-up via ensureBotCU()
 */

import { prisma } from '@/lib/prisma'
import { createBotLLMService } from '@/lib/llm'
import { fetchRssFeeds, detectHotTopics, type HotTopic } from '@/lib/services/rss'
import { createCommitment } from '@/lib/services/commitment'
import { createLogger } from '@/lib/logger'
import { slugify, generateUniqueSlug } from '@/lib/utils/slugify'
import type { BotAction } from '@prisma/client'

const log = createLogger('bot-runner')

export interface BotRunSummary {
  botId: string
  botName: string
  forecastsCreated: number
  votes: number
  skipped: number
  errors: number
  dryRun: boolean
  hotTopics?: HotTopic[]
}

/**
 * Run all bots that are due (based on lastRunAt + intervalMinutes).
 */
export async function runDueBots(dryRun = false): Promise<BotRunSummary[]> {
  const now = new Date()

  const bots = await prisma.botConfig.findMany({
    where: { isActive: true },
    include: { user: true },
  })

  const summaries: BotRunSummary[] = []

  for (const bot of bots) {
    // Check if the bot is due
    if (bot.lastRunAt) {
      const nextRunAt = new Date(bot.lastRunAt.getTime() + bot.intervalMinutes * 60 * 1000)
      if (nextRunAt > now) {
        log.debug({ botId: bot.id, nextRunAt }, 'Bot not due yet, skipping')
        continue
      }
    }

    const summary = await runBot(bot, dryRun)
    summaries.push(summary)

    // Only update lastRunAt if the bot actually ran (not skipped by active hours gate).
    // runBot() returns early without setting a flag, so we use forecastsCreated+votes+skipped+errors
    // to distinguish "ran but did nothing" from "was gated out".
    // The gate sets summary.skipped = -1 as a sentinel to signal no-update.
    if (!dryRun && summary.skipped !== -1) {
      await prisma.botConfig.update({
        where: { id: bot.id },
        data: { lastRunAt: now },
      })
    }
  }

  return summaries
}

/**
 * Run a specific bot by ID (for "Run now" admin action).
 */
export async function runBotById(botId: string, dryRun = false): Promise<BotRunSummary> {
  const bot = await prisma.botConfig.findUnique({
    where: { id: botId },
    include: { user: true },
  })

  if (!bot) throw new Error(`Bot not found: ${botId}`)

  const summary = await runBot(bot, dryRun)

  if (!dryRun && summary.skipped !== -1) {
    await prisma.botConfig.update({
      where: { id: bot.id },
      data: { lastRunAt: new Date() },
    })
  }

  return summary
}

// ─── Internal ────────────────────────────────────────────────────────────────

type BotWithUser = Awaited<ReturnType<typeof prisma.botConfig.findMany>>[number] & {
  user: { id: string; name: string | null; cuAvailable: number }
}

async function runBot(bot: BotWithUser, dryRun: boolean): Promise<BotRunSummary> {
  const summary: BotRunSummary = {
    botId: bot.id,
    botName: bot.user.name ?? bot.id,
    forecastsCreated: 0,
    votes: 0,
    skipped: 0,
    errors: 0,
    dryRun,
  }

  // ── Active hours gate ────────────────────────────────────────────────────
  // Skip (without updating lastRunAt) when outside the configured UTC window.
  // Overnight ranges are supported: start=22, end=6 → active 10pm–6am UTC.
  if (bot.activeHoursStart != null && bot.activeHoursEnd != null) {
    const hour = new Date().getUTCHours()
    const inWindow =
      bot.activeHoursStart <= bot.activeHoursEnd
        ? hour >= bot.activeHoursStart && hour < bot.activeHoursEnd
        : hour >= bot.activeHoursStart || hour < bot.activeHoursEnd
    if (!inWindow) {
      log.debug(
        { botId: bot.id, hour, activeHoursStart: bot.activeHoursStart, activeHoursEnd: bot.activeHoursEnd },
        'Bot outside active window, skipping without updating lastRunAt',
      )
      summary.skipped = -1 // sentinel: tell caller not to update lastRunAt
      return summary
    }
  }

  log.info({ botId: bot.id, dryRun }, 'Running bot')

  try {
    const llm = createBotLLMService(bot.modelPreference)

    // ── Forecast creation ────────────────────────────────────────────────
    if (bot.canCreateForecasts) {
      const feedUrls = bot.newsSources as string[]

      const initialForecastCount = await countTodayActions(bot.id, 'CREATED_FORECAST')
      if (feedUrls.length > 0 && initialForecastCount < bot.maxForecastsPerDay) {
        const items = await fetchRssFeeds(feedUrls)
        const hotTopics = detectHotTopics(items, bot.hotnessMinSources, bot.hotnessWindowHours)
        summary.hotTopics = hotTopics

        log.info({ botId: bot.id, hotCount: hotTopics.length }, 'Hot topics detected')

        for (const topic of hotTopics) {
          // Atomic slot check: re-fetch count before each creation to prevent race conditions
          const todayForecastCount = await countTodayActions(bot.id, 'CREATED_FORECAST')
          if (todayForecastCount >= bot.maxForecastsPerDay) {
            log.info({ botId: bot.id, count: todayForecastCount }, 'Daily forecast limit reached')
            break
          }

          const created = await processTopic(bot, topic.title, topic.items.map(i => i.url), llm, dryRun)
          if (created === 'created') summary.forecastsCreated++
          else if (created === 'skipped') summary.skipped++
          else summary.errors++
        }

        if (hotTopics.length === 0) {
          await logBotAction(bot.id, 'SKIPPED', null, null, null, dryRun)
          summary.skipped++
        }
      } else if (feedUrls.length === 0) {
        log.warn({ botId: bot.id }, 'No RSS sources configured')
      }
    }

    // ── Voting ────────────────────────────────────────────────────────────
    if (bot.canVote) {
      const todayVoteCount = await countTodayActions(bot.id, 'VOTED')
      const voteSlotsLeft = bot.maxVotesPerDay - todayVoteCount

      if (voteSlotsLeft > 0) {
        const voted = await runVoting(bot, llm, dryRun, voteSlotsLeft)
        summary.votes += voted
      }
    }
  } catch (err) {
    log.error({ err, botId: bot.id }, 'Bot run failed')
    await logBotAction(bot.id, 'ERROR', null, null, String(err), dryRun)
    summary.errors++
  }

  return summary
}

async function processTopic(
  bot: BotWithUser,
  topicTitle: string,
  sourceUrls: string[],
  llm: ReturnType<typeof createBotLLMService>,
  dryRun: boolean,
): Promise<'created' | 'skipped' | 'error'> {
  try {
    // Dedup check: fetch recent forecast titles and ask LLM
    const recentForecasts = await prisma.prediction.findMany({
      where: { status: { in: ['ACTIVE', 'PENDING'] } },
      select: { claimText: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const existingTitles = recentForecasts.map(f => f.claimText).join('\n- ')
    const dedupPrompt = `You are checking if a news topic is already covered by an existing forecast.

News topic: "${topicTitle}"

Existing forecasts:
- ${existingTitles}

Does this topic already have a forecast? Reply with only "yes" or "no".`

    const dedupResult = await llm.generateContent({ prompt: dedupPrompt, temperature: 0 })
    const alreadyExists = dedupResult.text.trim().toLowerCase().startsWith('yes')

    if (alreadyExists) {
      log.info({ botId: bot.id, topic: topicTitle }, 'Topic already covered, skipping')
      await logBotAction(bot.id, 'SKIPPED', { title: topicTitle, urls: sourceUrls }, null, null, dryRun)
      return 'skipped'
    }

    // Build tag constraint for prompt injection when tagFilter is set
    const tagFilter = bot.tagFilter as string[]
    const tagConstraint =
      tagFilter.length > 0
        ? `\nConstraint: assign one of these tag slugs to this forecast: ${tagFilter.join(', ')}. If the news topic does not fit any of these tags, respond with exactly: {"skip": true}`
        : ''

    // Generate a forecast from this topic
    const now = new Date()
    const forecastPrompt = `${bot.personaPrompt}

${bot.forecastPrompt}

News topic: "${topicTitle}"
Source URLs: ${sourceUrls.slice(0, 3).join(', ')}
Today's date: ${now.toISOString().split('T')[0]}

Generate a forecast as JSON with these fields:
{
  "claimText": "A testable prediction statement starting with 🤖, max 200 chars",
  "detailsText": "Background context and resolution criteria, 2-4 sentences",
  "outcomeType": "BINARY",
  "resolveByDatetime": "ISO date string, 30-180 days from now",
  "resolutionRules": "How to determine if the forecast resolves correctly, 1-2 sentences",
  "tags": ["tag1", "tag2"]
}

Rules:
- claimText MUST start with "🤖 "
- Be specific and verifiable
- Use English
- resolveByDatetime must be in the future${tagConstraint}`

    const response = await llm.generateContent({ prompt: forecastPrompt, temperature: 0.7, schema: true as never })

    // Check for tag-filter skip signal before full parse
    const rawText = response.text.trim()
    if (tagFilter.length > 0 && rawText.includes('"skip"') && rawText.includes('true')) {
      try {
        const skipCheck = JSON.parse(rawText.match(/\{[\s\S]*\}/)?.[0] ?? rawText)
        if (skipCheck?.skip === true) {
          log.info({ botId: bot.id, topic: topicTitle, tagFilter }, 'Topic does not match tag filter, skipping')
          await logBotAction(bot.id, 'SKIPPED', { title: topicTitle, urls: sourceUrls }, null, null, dryRun)
          return 'skipped'
        }
      } catch {
        // not a skip signal, continue to full parse
      }
    }

    let forecast: {
      claimText: string
      detailsText?: string
      outcomeType: string
      resolveByDatetime: string
      resolutionRules?: string
      tags?: string[]
    }

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      forecast = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
    } catch {
      log.warn({ botId: bot.id, topic: topicTitle, raw: response.text }, 'Failed to parse LLM forecast JSON')
      await logBotAction(bot.id, 'ERROR', { title: topicTitle }, null, 'JSON parse failed', dryRun)
      return 'error'
    }

    // Validate minimum content
    if (!forecast.claimText || forecast.claimText.length < 10) {
      await logBotAction(bot.id, 'ERROR', { title: topicTitle }, null, 'Invalid claimText', dryRun)
      return 'error'
    }

    // Ensure 🤖 prefix
    if (!forecast.claimText.startsWith('🤖')) {
      forecast.claimText = `🤖 ${forecast.claimText}`
    }

    const generatedText = JSON.stringify(forecast, null, 2)

    if (dryRun) {
      log.info({ botId: bot.id, forecast }, 'DRY RUN: Would create forecast')
      await logBotAction(bot.id, 'CREATED_FORECAST', { title: topicTitle, urls: sourceUrls }, generatedText, null, true)
      return 'created'
    }

    // Create the prediction in the DB
    const resolveBy = new Date(forecast.resolveByDatetime)
    if (isNaN(resolveBy.getTime()) || resolveBy <= new Date()) {
      // Default to 90 days if LLM gave bad date
      resolveBy.setTime(Date.now() + 90 * 24 * 60 * 60 * 1000)
    }

    const baseSlug = slugify(forecast.claimText)
    const existingSlugs = await prisma.prediction.findMany({
      where: { slug: { startsWith: baseSlug } },
      select: { slug: true },
    }).then(rows => rows.map(r => r.slug).filter((s): s is string => s !== null))
    const uniqueSlug = generateUniqueSlug(baseSlug, existingSlugs)

    // Create as DRAFT
    const prediction = await prisma.prediction.create({
      data: {
        authorId: bot.userId,
        claimText: forecast.claimText.slice(0, 499),
        slug: uniqueSlug,
        detailsText: forecast.detailsText,
        outcomeType: 'BINARY',
        outcomePayload: { type: 'BINARY' },
        resolutionRules: forecast.resolutionRules,
        resolveByDatetime: resolveBy,
        source: 'bot',
        status: 'DRAFT',
        tags: forecast.tags?.length
          ? {
            connectOrCreate: forecast.tags.slice(0, 5).map((tagName: string) => {
              const tagSlug = slugify(tagName)
              return {
                where: { slug: tagSlug },
                create: { name: tagName, slug: tagSlug },
              }
            }),
          }
          : undefined,
      },
    })

    // Publish (DRAFT → ACTIVE)
    await prisma.prediction.update({
      where: { id: prediction.id },
      data: { status: 'ACTIVE', publishedAt: new Date() },
    })

    // Auto-refill CU if balance is low, then stake on own forecast
    await ensureBotCU(bot, dryRun)
    const stakeAmount = randomInt(bot.stakeMin, bot.stakeMax)
    await createCommitment(bot.userId, prediction.id, {
      cuCommitted: stakeAmount,
      binaryChoice: true, // Bot always votes "yes" on its own forecast
    })

    await logBotAction(bot.id, 'CREATED_FORECAST', { title: topicTitle, urls: sourceUrls }, generatedText, null, false, prediction.id)

    log.info({ botId: bot.id, predictionId: prediction.id, stakeAmount }, 'Bot created forecast and staked')
    return 'created'
  } catch (err) {
    log.error({ err, botId: bot.id, topic: topicTitle }, 'Failed to process topic')
    await logBotAction(bot.id, 'ERROR', { title: topicTitle }, null, String(err), dryRun)
    return 'error'
  }
}

async function runVoting(
  bot: BotWithUser,
  llm: ReturnType<typeof createBotLLMService>,
  dryRun: boolean,
  maxVotes: number,
): Promise<number> {
  const tagFilter = bot.tagFilter as string[]

  // Fetch open forecasts the bot hasn't voted on yet.
  // If tagFilter is set, restrict to forecasts that have at least one matching tag.
  const candidates = await prisma.prediction.findMany({
    where: {
      status: 'ACTIVE',
      authorId: { not: bot.userId },
      commitments: { none: { userId: bot.userId } },
      ...(tagFilter.length > 0 && {
        tags: { some: { slug: { in: tagFilter } } },
      }),
    },
    select: { id: true, claimText: true, detailsText: true, outcomeType: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  if (candidates.length === 0) return 0

  // Build vote bias hint (omit when neutral)
  const biasHint =
    bot.voteBias !== 50
      ? `\nYour current disposition is ${bot.voteBias}/100 toward YES (0 = strongly lean NO, 50 = neutral, 100 = strongly lean YES).`
      : ''

  let voted = 0

  for (const forecast of candidates.slice(0, Math.min(maxVotes, candidates.length))) {
    if (voted >= maxVotes) break

    try {
      const votePrompt = `${bot.personaPrompt}

${bot.votePrompt}

Forecast: "${forecast.claimText}"
Details: "${forecast.detailsText ?? 'None'}"
${biasHint}
Should this bot commit to this forecast? If yes, what is the binary choice (true = yes it will happen, false = no it won't)?

Respond with JSON: { "shouldVote": true|false, "binaryChoice": true|false, "reason": "brief reason" }`

      const response = await llm.generateContent({ prompt: votePrompt, temperature: 0.5, schema: true as never })

      let decision: { shouldVote: boolean; binaryChoice: boolean; reason?: string }
      try {
        const text = response.text.trim()
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        decision = JSON.parse(jsonMatch ? jsonMatch[0] : text)
      } catch {
        continue
      }

      if (!decision.shouldVote) continue

      const generatedText = JSON.stringify(decision, null, 2)

      // Auto-refill CU if balance is low, then stake
      await ensureBotCU(bot, dryRun)
      const stakeAmount = randomInt(bot.stakeMin, bot.stakeMax)

      if (dryRun) {
        await logBotAction(bot.id, 'VOTED', { forecastTitle: forecast.claimText }, generatedText, null, true, forecast.id)
        voted++
        continue
      }

      const result = await createCommitment(bot.userId, forecast.id, {
        cuCommitted: stakeAmount,
        binaryChoice: decision.binaryChoice,
      })

      if (result.ok) {
        await logBotAction(bot.id, 'VOTED', { forecastTitle: forecast.claimText }, generatedText, null, false, forecast.id)
        voted++
      } else {
        log.warn({ botId: bot.id, forecastId: forecast.id, error: result.error }, 'Vote failed')
      }
    } catch (err) {
      log.error({ err, botId: bot.id, forecastId: forecast.id }, 'Vote error')
    }
  }

  return voted
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Ensure the bot has enough CU to stake. If `cuRefillAt > 0` and the bot's
 * current balance is at or below the threshold, create an ADMIN_GRANT
 * CuTransaction and increment cuAvailable by cuRefillAmount.
 * No-ops in dry-run mode or when cuRefillAt === 0 (feature disabled).
 */
async function ensureBotCU(bot: BotWithUser, dryRun: boolean): Promise<void> {
  if (dryRun) return
  const cuRefillAt = bot.cuRefillAt ?? 0
  if (cuRefillAt === 0) return

  const freshUser = await prisma.user.findUnique({
    where: { id: bot.userId },
    select: { cuAvailable: true },
  })
  if (!freshUser || freshUser.cuAvailable > cuRefillAt) return

  const amount = bot.cuRefillAmount ?? 50
  await prisma.$transaction([
    prisma.cuTransaction.create({
      data: {
        userId: bot.userId,
        type: 'ADMIN_ADJUSTMENT',
        amount,
        balanceAfter: freshUser.cuAvailable + amount,
        note: 'bot auto-refill',
      },
    }),
    prisma.user.update({
      where: { id: bot.userId },
      data: { cuAvailable: { increment: amount } },
    }),
  ])
  log.info({ botId: bot.id, amount, balanceBefore: freshUser.cuAvailable }, 'Bot CU auto-refilled')
}

async function countTodayActions(botId: string, action: BotAction): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  return prisma.botRunLog.count({
    where: {
      botId,
      action,
      isDryRun: false,
      runAt: { gte: startOfDay },
    },
  })
}

async function logBotAction(
  botId: string,
  action: BotAction,
  triggerNews: object | null,
  generatedText: string | null,
  error: string | null,
  isDryRun: boolean,
  forecastId?: string,
): Promise<void> {
  try {
    await prisma.botRunLog.create({
      data: {
        botId,
        action,
        triggerNews: triggerNews ?? undefined,
        generatedText,
        forecastId,
        isDryRun,
        error,
      },
    })
  } catch (err) {
    log.error({ err }, 'Failed to write bot run log')
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
