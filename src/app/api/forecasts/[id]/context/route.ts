import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { apiError, handleRouteError } from '@/lib/api-error'
import { withAuth, type RouteContext } from '@/lib/api-middleware'
import { getPromptTemplate, fillPrompt } from '@/lib/llm/bedrock-prompts'
import { llmService } from '@/lib/llm'
import { searchArticles, type SearchResult } from '@/lib/utils/webSearch'
import { oracleSearch } from '@/lib/services/oracleSearch'
import { guessChances } from '@/lib/llm/expressPrediction'
import { getOracleForecast, DEFAULT_MAX_ARTICLES, type OracleSource } from '@/lib/services/oracle'
import { createLogger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import {
  getContextTimeline,
  getForecastForContextUpdate,
  countUserContextUpdates,
  saveContextUpdate,
  listContextSnapshots,
} from '@/lib/services/context'

const log = createLogger('forecast-context')

/** Per-forecast cooldown between context updates (hours). */
const CONTEXT_UPDATE_COOLDOWN_HOURS = 1

export const dynamic = 'force-dynamic'

/** Raw Next.js 15 context where params is a Promise. Used for direct exports. */
type RawRouteContext = {
    params: Promise<{ id: string }>
}

// GET — public endpoint returning context timeline (direct export, must use Promise params)
export async function GET(request: NextRequest, { params }: RawRouteContext) {
    try {
        const { id } = await params
        const prediction = await getContextTimeline(id)

        if (!prediction) {
            return apiError('Prediction not found', 404)
        }

        return NextResponse.json({
            currentContext: prediction.detailsText,
            contextUpdatedAt: prediction.contextUpdatedAt,
            snapshots: prediction.contextSnapshots,
        })
    } catch (error) {
        return handleRouteError(error, 'Failed to fetch context timeline')
    }
}

// POST — protected endpoint (wrapped by withAuth, params already awaited)
export const POST = withAuth(async (request: NextRequest, user, { params }: RouteContext) => {
    try {
        const { id } = params
        const prediction = await getForecastForContextUpdate(id)

        if (!prediction) {
            return apiError('Prediction not found', 404)
        }

        // Any logged-in user can trigger a context analysis

        if (prediction.status !== 'ACTIVE') {
            return apiError('Context can only be updated for active predictions', 400)
        }

        // Rate Limiting: per-forecast cooldown
        if (prediction.contextUpdatedAt) {
            const now = new Date()
            const timeDiffHours = (now.getTime() - new Date(prediction.contextUpdatedAt).getTime()) / (1000 * 60 * 60)
            if (timeDiffHours < CONTEXT_UPDATE_COOLDOWN_HOURS) {
                const label = CONTEXT_UPDATE_COOLDOWN_HOURS === 1
                    ? 'an hour'
                    : `${CONTEXT_UPDATE_COOLDOWN_HOURS} hours`
                return apiError(`Context was updated recently. Please wait ${label} between updates.`, 429)
            }
        }

        // Rate Limiting: max 10 context updates per user per day across all forecasts
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const dailyUserCount = await countUserContextUpdates(user.id, cutoff)
        if (dailyUserCount >= 10) {
            return apiError('Daily context update limit reached (10 per day). Please try again tomorrow.', 429)
        }

        // 1. Search for recent articles
        // Clean up news anchor title: strip subtitle after " | " or " – " (common in Wikipedia-style titles)
        const rawQuery = prediction.newsAnchor?.title || prediction.claimText
        const searchQuery = rawQuery.split(/\s+[|—–]\s+/)[0].trim()
        // `searchArticles` throws "Search API not available" when every provider in the
        // fallback chain fails (e.g. transient ECONNRESET on DDG when paid providers are
        // unconfigured). Convert that into a clean 503 instead of leaking a 500 to the client.
        let searchResults: SearchResult[]
        const t0 = Date.now()
        try {
            searchResults = await oracleSearch(searchQuery, DEFAULT_MAX_ARTICLES) ?? await searchArticles(searchQuery, DEFAULT_MAX_ARTICLES)
        } catch (err) {
            log.warn(
                { predictionId: prediction.id, searchQuery, err },
                'context.search_failed',
            )
            return apiError('No recent articles found for this forecast. Try again later.', 503)
        }
        const searchMs = Date.now() - t0

        log.info(
            {
                predictionId: prediction.id,
                searchQuery,
                resultCount: searchResults.length,
                resultDomains: searchResults.map((r) => {
                    try { return new URL(r.url).hostname } catch { return r.url }
                }),
            },
            'context.search_done',
        )

        if (searchResults.length === 0) {
            return apiError('No recent articles found for this forecast. Try again later.', 503)
        }

        // Build sources array
        const sources = searchResults.map((article: SearchResult) => ({
            title: article.title,
            url: article.url,
            source: article.source || null,
            publishedDate: article.publishedDate || null,
        }))

        const articlesText = searchResults
            .map((article: SearchResult, i: number) => {
                return `[Article ${i + 1}]\nTitle: ${article.title}\nSource: ${article.source || 'Unknown'}\nPublished: ${article.publishedDate || 'Unknown'}\nSnippet: ${article.snippet}\n`
            })
            .join('\n')

        // 2. Query LLM to summarize new context
        const currentYear = new Date().getFullYear()
        const template = await getPromptTemplate('update-context')
        const changeInstruction = prediction.detailsText
            ? `\nPrevious context summary:\n"${prediction.detailsText}"\n\nFocus on what has CHANGED since the previous summary. Highlight new developments.\n`
            : ''
        const prompt = fillPrompt(template, {
            claimText: prediction.claimText,
            articlesText,
            currentYear,
            changeInstruction,
        })

        const t1 = Date.now()
        const result = await llmService.generateContent({
            prompt,
            temperature: 0.2,
        })

        const newContextSummary = result.text.trim()
        const llmMs = Date.now() - t1
        const now = new Date()

        // 3. AI probability — try Oracle first, fall back to LLM guessChances
        let externalProbability: number | null = null
        let externalReasoning: string | null = null
        // Denormalized CI bounds for the Prediction row so list endpoints render
        // the range without joining ContextSnapshot. Null when the LLM-fallback path
        // ran (no CI available) so we know to clear stale values from a prior Oracle run.
        let predictionCiLow: number | null = null
        let predictionCiHigh: number | null = null
        // When the Oracle path is taken, persist the full payload (CI + sources) so
        // the UI can render provenance. Shape is camelCased for frontend consumption.
        let oracleSnapshotData: Prisma.InputJsonValue | null = null

        const t2 = Date.now()
        const oracleForecast = await getOracleForecast(prediction.claimText, {
            articles: searchResults.map(r => ({
                url: r.url,
                title: r.title,
                snippet: r.snippet,
                source: r.source,
                publishedDate: r.publishedDate,
            })),
        })
        if (oracleForecast !== null) {
            const toPercent = (v: number) => Math.round(((v + 1) / 2) * 100)
            externalProbability = toPercent(oracleForecast.mean)
            predictionCiLow = toPercent(oracleForecast.ci_low)
            predictionCiHigh = toPercent(oracleForecast.ci_high)
            externalReasoning = 'TruthMachine Oracle (calibrated multi-source estimate)'
            log.info(
                {
                    predictionId: prediction.id,
                    path: 'oracle',
                    probability: externalProbability,
                    articlesUsed: oracleForecast.articles_used,
                    sourceCount: oracleForecast.sources.length,
                },
                'context.ai_estimate',
            )
            oracleSnapshotData = {
                mean: oracleForecast.mean,
                std: oracleForecast.std,
                ciLow: predictionCiLow,
                ciHigh: predictionCiHigh,
                articlesUsed: oracleForecast.articles_used,
                sources: oracleForecast.sources.map((s: OracleSource) => ({
                    sourceId: s.source_id,
                    sourceName: s.source_name,
                    url: s.url,
                    stance: s.stance,
                    certainty: s.certainty,
                    credibilityWeight: s.credibility_weight,
                    claims: s.claims,
                })),
            }
        } else {
            const articlesMapped = searchResults.map((r: SearchResult) => ({
                title: r.title,
                source: r.source || 'Unknown',
                snippet: r.snippet,
            }))
            try {
                const chances = await guessChances(
                    prediction.claimText,
                    prediction.detailsText ?? '',
                    articlesMapped
                )
                externalProbability = chances.probability
                externalReasoning = chances.reasoning
                log.info(
                    {
                        predictionId: prediction.id,
                        path: 'llm_fallback',
                        probability: externalProbability,
                        reason: 'oracle_returned_null',
                    },
                    'context.ai_estimate',
                )
            } catch (err) {
                log.warn(
                    { predictionId: prediction.id, err, path: 'llm_fallback' },
                    'context.ai_estimate_failed',
                )
            }
        }

        const oracleMs = Date.now() - t2
        const totalMs = Date.now() - t0

        log.info(
            { predictionId: prediction.id, searchMs, llmMs, oracleMs, totalMs },
            'context.timings',
        )

        // Persist timing sample for population-level calibration (non-critical)
        prisma.contextTiming.create({ data: { searchMs, llmMs, oracleMs, totalMs } }).catch(() => { /* non-critical */ })

        // 4. Persist snapshot + update prediction
        const snapshot = await saveContextUpdate({
            predictionId: prediction.id,
            summary: newContextSummary,
            sources,
            externalProbability,
            externalReasoning,
            oracleSnapshot: oracleSnapshotData,
            confidence: externalProbability,
            aiCiLow: predictionCiLow,
            aiCiHigh: predictionCiHigh,
            now,
        })

        // Fetch full timeline
        const snapshots = await listContextSnapshots(prediction.id)

        return NextResponse.json({
            success: true,
            newContext: newContextSummary,
            contextUpdatedAt: now,
            snapshot,
            timeline: snapshots,
            timings: { searchMs, llmMs, oracleMs, totalMs },
        })

    } catch (error) {
        return handleRouteError(error, 'Failed to update prediction context')
    }
})
