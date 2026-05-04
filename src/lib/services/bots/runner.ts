/**
 * Bot runner service.
 *
 * Called by /api/bots/run on a schedule (GitHub Actions every 5 minutes).
 * For each active bot that is "due", it:
 * 1. Fetches RSS feeds configured for the bot
 * 2. Detects hot topics (appearing in multiple sources)
 * 3. Deduplicates against existing forecast titles (LLM-based)
 * 4. Generates and posts a new forecast (with 🤖 in title)
 * 5. Stakes on the forecast immediately (or defers if requireApprovalForForecasts)
 * 6. Optionally votes on existing ACTIVE forecasts
 * 7. Logs all actions to BotRunLog
 */

import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { embedAndStoreForecast } from '@/lib/services/embedding'
import { createBotLLMService } from '@/lib/llm'
import { getPromptTemplate, fillPrompt } from '@/lib/llm/bedrock-prompts'
import { fetchRssFeeds, detectHotTopics, type HotTopic } from '@/lib/services/bots/rss'
import {
  createCommitment,
  emitCreateCommitmentSideEffects,
  type CommitmentPrediction,
} from '@/lib/services/commitment'
import { createLogger } from '@/lib/logger'
import { slugify, generateUniqueSlug } from '@/lib/utils/slugify'
import { BotAction } from '@prisma/client'
import { forecastBatchSchema, voteDecisionSchema } from '@/lib/llm/schemas'
import type { Schema } from '@google/generative-ai'

const log = createLogger('bot-runner')

// ─── Error Types for Better Diagnostics ───────────────────────────────────

class TopicProcessingError extends Error {
  constructor(
    readonly stage: 'dedup' | 'generation' | 'quality_gate' | 'validation' | 'database' | 'staking',
    readonly type: 'timeout' | 'parse' | 'validation' | 'database' | 'other',
    message: string,
  ) {
    super(message)
    this.name = 'TopicProcessingError'
  }
}

// ─── Metrics for Observability ──────────────────────────────────────────────

interface RunMetrics {
  startedAt: number
  rssFeatchDurationMs?: number
  hotTopicsDetectionMs?: number
  totalProcessingMs?: number
  databaseQueryMs?: number
  llmCallsMs?: number
}

function startMetrics(): RunMetrics {
  return { startedAt: Date.now() }
}

function endMetrics(metrics: RunMetrics): RunMetrics {
  metrics.totalProcessingMs = Date.now() - metrics.startedAt
  return metrics
}

// ─── LLM Call Helpers with Timeout & Retry ─────────────────────────────────

const LLM_CALL_TIMEOUT_MS = 10000 // 10 second timeout per LLM call
const LLM_RETRY_ATTEMPTS = 2 // Total of 2 attempts (1 initial + 1 retry)
const LLM_RETRY_DELAY_MS = 1000 // 1 second delay before retry

// Deterministic resolveByDatetime range. Done in code, not in the LLM quality
// gate prompt — the LLM has no concept of "today" and was rejecting valid
// future dates as "too far in the future" using its training cutoff as now.
const MIN_RESOLVE_DAYS = 14
const MAX_RESOLVE_DAYS = 365

interface LLMCallOptions {
  prompt: string
  temperature?: number
  schema?: Schema
  timeoutMs?: number
  maxAttempts?: number
}

/**
 * Call LLM with timeout and retry logic.
 * Throws on timeout or after max retries, allowing caller to decide handling.
 */
async function callLLMWithTimeout(
  llm: ReturnType<typeof createBotLLMService>,
  options: LLMCallOptions,
): Promise<{ text: string }> {
  const { prompt, temperature = 0, schema, timeoutMs = LLM_CALL_TIMEOUT_MS, maxAttempts = LLM_RETRY_ATTEMPTS } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let timeoutId: NodeJS.Timeout | undefined
    try {
      const controller = new AbortController()
      timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const result = await Promise.race([
        llm.generateContent({ prompt, temperature, schema }),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error(`LLM call timeout after ${timeoutMs}ms`))
          })
        }),
      ])

      clearTimeout(timeoutId)
      return result
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId)
      const isTimeout = err instanceof Error && err.message.includes('timeout')
      const isLastAttempt = attempt === maxAttempts

      if (isTimeout) {
        log.warn({ attempt, maxAttempts, timeoutMs }, `LLM call timeout (attempt ${attempt}/${maxAttempts})`)
        if (isLastAttempt) throw err
        await new Promise(resolve => setTimeout(resolve, LLM_RETRY_DELAY_MS))
        continue
      }

      // Non-timeout errors: fail immediately
      throw err
    }
  }

  throw new Error(`LLM call failed after ${maxAttempts} attempts`)
}

export interface BotRunSummary {
  botId: string
  botName: string
  forecastsCreated: number
  votes: number
  skipped: number
  errors: number
  dryRun: boolean
  gatedByActiveHours: boolean
  hotTopics?: HotTopic[]
  fetchedCount?: number
  sampleItems?: string[]
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

    const summary = await runBot(bot, dryRun, false)
    summaries.push(summary)

    // Only update lastRunAt if the bot actually ran (not gated out by active hours).
    if (!dryRun && !summary.gatedByActiveHours) {
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

  const summary = await runBot(bot, dryRun, true)

  if (!dryRun && !summary.gatedByActiveHours) {
    await prisma.botConfig.update({
      where: { id: bot.id },
      data: { lastRunAt: new Date() },
    })
  }

  return summary
}

// ─── Internal ────────────────────────────────────────────────────────────────

type BotWithUser = Awaited<ReturnType<typeof prisma.botConfig.findMany>>[number] & {
  user: { id: string; name: string | null }
}

async function runBot(bot: BotWithUser, dryRun: boolean, isManual: boolean = false): Promise<BotRunSummary> {
  const summary: BotRunSummary = {
    botId: bot.id,
    botName: bot.user.name ?? bot.id,
    forecastsCreated: 0,
    votes: 0,
    skipped: 0,
    errors: 0,
    dryRun,
    gatedByActiveHours: false,
  }

  // ── Active hours gate ────────────────────────────────────────────────────
  // Skip (without updating lastRunAt) when outside the configured UTC window.
  // Overnight ranges are supported: start=22, end=6 → active 10pm–6am UTC.
  if (!isManual && bot.activeHoursStart != null && bot.activeHoursEnd != null) {
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
      summary.gatedByActiveHours = true
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
        const metrics = startMetrics()

        const rssFetchStart = Date.now()
        const items = await fetchRssFeeds(feedUrls)
        metrics.rssFeatchDurationMs = Date.now() - rssFetchStart

        summary.fetchedCount = items.length
        summary.sampleItems = items.slice(0, 5).map(i => i.title)

        const hotTopicsStart = Date.now()
        const hotTopics = detectHotTopics(items, bot.hotnessMinSources, bot.hotnessWindowHours)
        metrics.hotTopicsDetectionMs = Date.now() - hotTopicsStart
        summary.hotTopics = hotTopics

        log.info({
          botId: bot.id,
          hotCount: hotTopics.length,
          minSources: bot.hotnessMinSources,
          windowHours: bot.hotnessWindowHours,
          fetchedCount: items.length
        }, 'Hot topics detection result')

        // Fetch recent forecasts ONCE before processing topics (avoid N+1 queries)
        // Only fetch predictions that are ACTIVE or in approval workflows
        const recentForecasts = await prisma.prediction.findMany({
          where: { status: { in: ['ACTIVE', 'PENDING_APPROVAL', 'PENDING'] } },
          select: { claimText: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
        const existingTitles = recentForecasts.map(f => f.claimText).join('\n- ')

        for (const topic of hotTopics) {
          // Rate limit check (note: subject to TOCTOU if multiple instances run simultaneously)
          // We check before creation but another instance could create between check and our creation
          // This is acceptable: occasional overage is better than blocking all creation

          const todayForecastCount = await countTodayActions(bot.id, 'CREATED_FORECAST')
          if (todayForecastCount >= bot.maxForecastsPerDay) {
            log.info({ botId: bot.id, count: todayForecastCount, limit: bot.maxForecastsPerDay }, 'Daily forecast limit reached')
            break
          }

          // Hourly rate limiting: check if maxForecastsPerHour limit is reached
          if (bot.maxForecastsPerHour > 0) {
            const hourlyForecastCount = await countThisHourActions(bot.id, 'CREATED_FORECAST')
            if (hourlyForecastCount >= bot.maxForecastsPerHour) {
              log.info({ botId: bot.id, count: hourlyForecastCount, limit: bot.maxForecastsPerHour }, 'Hourly forecast limit reached')
              break
            }
          }

          const created = await processTopic(bot, topic.title, topic.items.map(i => i.url), llm, dryRun, existingTitles)
          if (created === 'created') {
            summary.forecastsCreated++

            // Post-check: verify we didn't exceed limits due to race condition
            if (!dryRun) {
              const finalTodayCount = await countTodayActions(bot.id, 'CREATED_FORECAST')
              const finalHourlyCount = bot.maxForecastsPerHour > 0 ? await countThisHourActions(bot.id, 'CREATED_FORECAST') : 0

              if (finalTodayCount > bot.maxForecastsPerDay) {
                log.warn(
                  { botId: bot.id, count: finalTodayCount, limit: bot.maxForecastsPerDay },
                  'Daily forecast limit exceeded (TOCTOU race: concurrent instances)',
                )
              }

              if (bot.maxForecastsPerHour > 0 && finalHourlyCount > bot.maxForecastsPerHour) {
                log.warn(
                  { botId: bot.id, count: finalHourlyCount, limit: bot.maxForecastsPerHour },
                  'Hourly forecast limit exceeded (TOCTOU race: concurrent instances)',
                )
              }
            }
          } else if (created === 'skipped') summary.skipped++
          else summary.errors++
        }

        if (hotTopics.length === 0) {
          log.info({ botId: bot.id, fetchedCount: items.length }, 'No hot topics detected from fetched items')
          await logBotAction(bot.id, 'SKIPPED', { reason: 'No hot topics detected', fetchedCount: items.length }, null, 'no hot topics detected', dryRun)
          summary.skipped++
        }

        // Log performance metrics
        endMetrics(metrics)
        log.debug(
          {
            botId: bot.id,
            rssFetchMs: metrics.rssFeatchDurationMs,
            hotTopicsMs: metrics.hotTopicsDetectionMs,
            totalMs: metrics.totalProcessingMs,
            topicsProcessed: summary.forecastsCreated + summary.skipped + summary.errors,
          },
          'Forecast creation batch completed (performance metrics)',
        )
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
  existingTitles: string,
): Promise<'created' | 'skipped' | 'error'> {
  try {
    // Dedup check: use cached existing titles to avoid N+1 query
    const dedupTemplate = await getPromptTemplate('dedupe-check')
    const dedupPrompt = fillPrompt(dedupTemplate, {
      topicTitle,
      existingTitles,
    })

    let dedupResult
    try {
      dedupResult = await callLLMWithTimeout(llm, { prompt: dedupPrompt, temperature: 0 })
    } catch (dedupErr) {
      const isTimeout = dedupErr instanceof Error && dedupErr.message.includes('timeout')
      log.warn(
        { botId: bot.id, topic: topicTitle, err: dedupErr, errorType: isTimeout ? 'timeout' : 'unknown' },
        'Dedup check failed, treating as unique topic (fail-open strategy)',
      )
      // Treat timeout/failure as "not duplicate" to allow forecast creation (fail open)
      dedupResult = { text: 'no' }
    }

    const alreadyExists = dedupResult.text.trim().toLowerCase().startsWith('yes')

    if (alreadyExists) {
      log.info({ botId: bot.id, topic: topicTitle }, 'Topic already covered, skipping')
      await logBotAction(bot.id, 'SKIPPED', { title: topicTitle, urls: sourceUrls }, null, 'topic already covered (dedup)', dryRun)
      return 'skipped'
    }

    // Build tag constraint for prompt injection when tagFilter is set.
    // Sanitize each tag to slug-safe chars only to prevent prompt injection.
    const tagFilter = bot.tagFilter as string[]
    const safeTags = tagFilter.map(t => t.replace(/[^a-z0-9_-]/g, '').trim()).filter(Boolean)
    const tagConstraint =
      safeTags.length > 0
        ? `\nConstraint: assign one of these tag slugs to this forecast: ${safeTags.join(', ')}. If the news topic does not fit any of these tags, set "skip": true in the JSON.`
        : `\nIf this news topic does not match your area of expertise or persona, set "skip": true in the JSON instead of generating a forecast.`

    // Generate a forecast from this topic
    const now = new Date()
    const forecastTemplate = await getPromptTemplate('bot-forecast-generation')
    const forecastPrompt = fillPrompt(forecastTemplate, {
      personaPrompt: bot.personaPrompt,
      forecastPrompt: bot.forecastPrompt,
      topicTitle,
      sourceUrls: sourceUrls.slice(0, 3).join(', '),
      todayDate: now.toISOString().split('T')[0],
      tagConstraint,
    })

    let response
    try {
      response = await callLLMWithTimeout(llm, { prompt: forecastPrompt, temperature: 0.7, schema: forecastBatchSchema })
    } catch (genErr) {
      const isTimeout = genErr instanceof Error && genErr.message.includes('timeout')
      log.error(
        { botId: bot.id, topic: topicTitle, err: genErr, errorType: isTimeout ? 'timeout' : 'other' },
        `Forecast generation failed (core operation - cannot proceed): ${isTimeout ? 'timeout' : 'error'}`,
      )
      await logBotAction(bot.id, 'ERROR', { title: topicTitle, reason: isTimeout ? 'generation_timeout' : 'generation_error' }, null, String(genErr), dryRun)
      return 'error'
    }

    // Check for skip signal before full parse (LLM can set skip:true when topic is out of scope)
    const rawText = response.text.trim()
    if (rawText.includes('"skip"') && rawText.includes('true')) {
      try {
        const skipCheck = JSON.parse(rawText.match(/\{[\s\S]*\}/)?.[0] ?? rawText)
        if (skipCheck?.skip === true) {
          log.info({ botId: bot.id, topic: topicTitle, tagFilter }, 'Topic out of scope, skipping')
          await logBotAction(bot.id, 'SKIPPED', { title: topicTitle, urls: sourceUrls }, null, `topic out of scope for tag filter '${tagFilter}'`, dryRun)
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
      const raw = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)
      // Sanitize tags at the LLM boundary — nulls in arrays crash slugify downstream
      forecast = {
        ...raw,
        tags: (raw.tags ?? []).filter((t: unknown): t is string => typeof t === 'string' && t.length > 0),
      }
    } catch (err) {
      log.warn({ botId: bot.id, topic: topicTitle, err, raw: response.text }, 'Failed to parse LLM forecast JSON')
      await logBotAction(bot.id, 'ERROR', { title: topicTitle, reason: 'JSON parse failed', raw: response.text }, null, 'JSON parse failed', dryRun)
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

    // ── Deterministic resolveByDatetime check (done in code, not LLM) ───
    // Catches LLM-generated dates outside our acceptable window before we
    // burn another LLM call on the quality gate.
    const resolveByCheck = new Date(forecast.resolveByDatetime)
    if (!isNaN(resolveByCheck.getTime())) {
      const days = (resolveByCheck.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      if (days < MIN_RESOLVE_DAYS || days > MAX_RESOLVE_DAYS) {
        const reason = `resolveByDatetime ${forecast.resolveByDatetime} is ${days.toFixed(0)} days out (need ${MIN_RESOLVE_DAYS}-${MAX_RESOLVE_DAYS})`
        log.info({ botId: bot.id, topic: topicTitle, reason }, 'Forecast date out of range')
        await logBotAction(bot.id, 'SKIPPED', { title: topicTitle, urls: sourceUrls, dateOutOfRange: true, daysOut: Math.round(days) }, null, reason, dryRun)
        return 'skipped'
      }
    }

    // ── Quality gate ─────────────────────────────────────────────────────
    // Ask LLM to validate forecast quality before saving
    const qualityTemplate = await getPromptTemplate('forecast-quality-validation')
    const qualityPrompt = fillPrompt(qualityTemplate, {
      claimText: forecast.claimText,
      detailsText: forecast.detailsText || 'None',
      resolveByDatetime: forecast.resolveByDatetime,
      resolutionRules: forecast.resolutionRules || 'None',
      topicTitle,
    })

    try {
      let qualityResult
      try {
        qualityResult = await callLLMWithTimeout(llm, { prompt: qualityPrompt, temperature: 0 })
      } catch (qualityTimeoutErr) {
        const isTimeout = qualityTimeoutErr instanceof Error && qualityTimeoutErr.message.includes('timeout')
        log.warn(
          { botId: bot.id, topic: topicTitle, err: qualityTimeoutErr, errorType: isTimeout ? 'timeout' : 'other' },
          'Quality gate failed, allowing forecast through (fail-open strategy)',
        )
        // On any failure: allow forecast through (fail open, lower priority check)
        qualityResult = { text: '{"pass": true}' }
      }

      const qText = qualityResult.text.trim()
      const qMatch = qText.match(/\{[\s\S]*\}/)
      const qualityCheck = JSON.parse(qMatch ? qMatch[0] : qText)

      if (!qualityCheck.pass) {
        const reason = qualityCheck.reason || 'quality gate failed'
        log.info({ botId: bot.id, topic: topicTitle, reason }, 'Forecast failed quality gate')
        await logBotAction(bot.id, 'SKIPPED', { title: topicTitle, urls: sourceUrls, qualityReason: reason }, null, reason, dryRun)
        return 'skipped'
      }
    } catch (parseErr) {
      log.warn({ botId: bot.id, topic: topicTitle, err: parseErr, errorType: 'parse' }, 'Quality gate response unparseable, allowing forecast (fail-open)')
      // On parse failure, allow the forecast through (fail open) to avoid blocking all forecasts
    }

    const generatedText = JSON.stringify(forecast, null, 2)

    if (dryRun) {
      log.info({ botId: bot.id, forecast }, 'DRY RUN: Would create forecast')
      await logBotAction(bot.id, 'CREATED_FORECAST', { title: topicTitle, urls: sourceUrls }, generatedText, null, true)
      return 'created'
    }

    // Create the prediction in the DB
    const resolveBy = new Date(forecast.resolveByDatetime)
    if (isNaN(resolveBy.getTime())) {
      log.warn({ botId: bot.id, topic: topicTitle, provided: forecast.resolveByDatetime }, 'Invalid resolveByDatetime format')
      await logBotAction(bot.id, 'ERROR', { title: topicTitle }, null, 'Invalid date format', dryRun)
      return 'error'
    }
    if (resolveBy <= new Date()) {
      log.warn({ botId: bot.id, topic: topicTitle, provided: resolveBy.toISOString() }, 'resolveByDatetime is in the past')
      await logBotAction(bot.id, 'ERROR', { title: topicTitle }, null, 'Past resolution date', dryRun)
      return 'error'
    }
    // Cap at 1 year from now
    const maxDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    if (resolveBy > maxDate) {
      resolveBy.setTime(maxDate.getTime())
    }

    // ── Rejection tracking: check if topic was previously rejected ──────────
    // Prevents bot from suggesting similar topics that admins have rejected
    if (bot.enableRejectionTracking) {
      const rejectedTopics = await prisma.botRejectedTopic.findMany({
        where: { botId: bot.id },
        select: { keywords: true, description: true },
        orderBy: { rejectedAt: 'desc' },
        take: 20, // Check most recent rejections
      })

      if (rejectedTopics.length > 0) {
        // Simple keyword-based similarity check (lightweight, no LLM)
        const claimLower = forecast.claimText.toLowerCase()
        const detailsLower = (forecast.detailsText || '').toLowerCase()
        const combinedText = `${claimLower} ${detailsLower}`

        for (const rejected of rejectedTopics) {
          // Check if any rejected keywords appear in the new forecast
          const keywordMatches = (rejected.keywords || []).filter(kw =>
            combinedText.includes(kw.toLowerCase()),
          )

          // If 50% or more of keywords match, consider it a similar topic
          if (rejected.keywords && rejected.keywords.length > 0) {
            const matchPercentage = (keywordMatches.length / rejected.keywords.length) * 100
            if (matchPercentage >= 50) {
              log.info(
                { botId: bot.id, topic: topicTitle, rejectedDescription: rejected.description, matchPercentage },
                'Forecast matches rejected topic, skipping (rejection tracking)',
              )
              await logBotAction(
                bot.id,
                'SKIPPED',
                { title: topicTitle, urls: sourceUrls, rejectionMatch: rejected.description },
                null,
                null,
                dryRun,
              )
              return 'skipped'
            }
          }
        }
      }
    }

    const baseSlug = slugify(forecast.claimText)
    const existingSlugs = await prisma.prediction.findMany({
      where: { slug: { startsWith: baseSlug } },
      select: { slug: true },
    }).then(rows => rows.map(r => r.slug).filter((s): s is string => s !== null))
    const uniqueSlug = generateUniqueSlug(baseSlug, existingSlugs)

    const predictionCreateData = {
      authorId: bot.userId,
      claimText: forecast.claimText.slice(0, 499),
      slug: uniqueSlug,
      detailsText: forecast.detailsText,
      outcomeType: 'BINARY' as const,
      outcomePayload: { type: 'BINARY' as const },
      resolutionRules: forecast.resolutionRules,
      resolveByDatetime: resolveBy,
      source: 'bot' as const,
      status: 'DRAFT' as const,
      shareToken: crypto.randomBytes(8).toString('hex'),
      tags: forecast.tags?.length
        ? {
          connectOrCreate: forecast.tags
            .filter((t: unknown): t is string => typeof t === 'string' && t.length > 0)
            .slice(0, 5)
            .map((tagName: string) => {
              const tagSlug = slugify(tagName)
              return {
                where: { slug: tagSlug },
                create: { name: tagName, slug: tagSlug },
              }
            }),
        }
        : undefined,
    }

    // Publish: determine status based on approval workflow
    // If requireApprovalForForecasts is true, create as PENDING_APPROVAL (don't stake yet)
    // If autoApprove is true, go directly to ACTIVE
    // Otherwise, use PENDING_APPROVAL (standard bot behavior)
    const publishStatus = bot.requireApprovalForForecasts ? 'PENDING_APPROVAL' : (bot.autoApprove ? 'ACTIVE' : 'PENDING_APPROVAL')

    let prediction
    let stakeAmount: number | null = null

    if (bot.requireApprovalForForecasts) {
      prediction = await prisma.prediction.create({ data: predictionCreateData })
      await prisma.prediction.update({
        where: { id: prediction.id },
        data: { status: publishStatus, publishedAt: new Date() },
      })
    } else {
      const stake = randomInt(bot.stakeMin, bot.stakeMax)
      stakeAmount = stake
      try {
        const out = await prisma.$transaction(async (tx) => {
          const pred = await tx.prediction.create({ data: predictionCreateData })
          await tx.prediction.update({
            where: { id: pred.id },
            data: { status: publishStatus, publishedAt: new Date() },
          })
          const stakeResult = await createCommitment(
            bot.userId,
            pred.id,
            { confidence: stake },
            { tx },
          )
          if (!stakeResult.ok) {
            throw new Error(stakeResult.error ?? 'Commitment failed')
          }
          return { prediction: pred, stakeResult }
        })
        prediction = out.prediction
        emitCreateCommitmentSideEffects(
          { ...out.prediction, options: [] } as CommitmentPrediction,
          out.stakeResult.data,
          { confidence: stake },
        )
      } catch (stakeErr) {
        log.error(
          { err: stakeErr, botId: bot.id, topic: topicTitle },
          'Forecast create+stake transaction failed',
        )
        await logBotAction(bot.id, 'ERROR', { title: topicTitle }, null, String(stakeErr), dryRun)
        return 'error'
      }
    }

    // Fire-and-forget: store embedding for similar-forecast search
    embedAndStoreForecast(prediction.id, predictionCreateData.claimText).catch(() => {/* non-critical */})

    await logBotAction(bot.id, 'CREATED_FORECAST', { title: topicTitle, urls: sourceUrls }, generatedText, null, false, prediction.id)

    if (stakeAmount !== null) {
      log.info({ botId: bot.id, predictionId: prediction.id, stakeAmount }, 'Bot created forecast and staked')
    } else {
      log.info({ botId: bot.id, predictionId: prediction.id }, 'Bot created forecast (approval required, staking deferred)')
    }
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
      outcomeType: 'BINARY',
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
      const voteTemplate = await getPromptTemplate('bot-vote-decision')
      const votePrompt = fillPrompt(voteTemplate, {
        personaPrompt: bot.personaPrompt,
        votePrompt: bot.votePrompt,
        claimText: forecast.claimText,
        detailsText: forecast.detailsText ?? 'No additional details provided',
        biasHint,
      })

      let response
      try {
        response = await callLLMWithTimeout(llm, { prompt: votePrompt, temperature: 0.5, schema: voteDecisionSchema })
      } catch (voteErr) {
        log.warn({ botId: bot.id, forecastId: forecast.id, err: voteErr }, 'Vote decision timed out, skipping')
        continue // Skip this forecast on timeout
      }

      let decision: { shouldVote: boolean; binaryChoice: boolean; reason?: string }
      try {
        const text = response.text.trim()
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        decision = JSON.parse(jsonMatch ? jsonMatch[0] : text)
      } catch (parseErr) {
        log.warn(
          { botId: bot.id, forecastId: forecast.id, err: parseErr, responseLength: response.text.length },
          'Vote decision unparseable, skipping',
        )
        continue
      }

      // Validate decision structure
      if (typeof decision.shouldVote !== 'boolean') {
        log.warn({ botId: bot.id, forecastId: forecast.id, decision }, 'Invalid shouldVote type, skipping')
        continue
      }

      if (!decision.shouldVote) continue

      if (typeof decision.binaryChoice !== 'boolean') {
        log.warn({ botId: bot.id, forecastId: forecast.id, decision }, 'Invalid binaryChoice type, defaulting to true')
        decision.binaryChoice = true
      }

      const generatedText = JSON.stringify(decision, null, 2)

      const stakeAmount = randomInt(bot.stakeMin, bot.stakeMax)

      if (dryRun) {
        await logBotAction(bot.id, 'VOTED', { forecastTitle: forecast.claimText }, generatedText, null, true, forecast.id)
        voted++
        continue
      }

      const result = await createCommitment(bot.userId, forecast.id, {
        confidence: decision.binaryChoice ? stakeAmount : -stakeAmount,
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

async function countThisHourActions(botId: string, action: BotAction): Promise<number> {
  const startOfHour = new Date()
  startOfHour.setMinutes(0, 0, 0)

  return prisma.botRunLog.count({
    where: {
      botId,
      action,
      isDryRun: false,
      runAt: { gte: startOfHour },
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
