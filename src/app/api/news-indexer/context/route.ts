import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { env } from '@/env'
import { prisma } from '@/lib/prisma'
import { apiError, handleRouteError } from '@/lib/api-error'
import { getOracleForecast } from '@/lib/services/oracle'
import { saveNewsIndexerMatch } from '@/lib/services/context'
import { notifyNewsArticleMatched } from '@/lib/services/telegram'
import { createLogger } from '@/lib/logger'

const log = createLogger('news-indexer-context')

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  predictionId: z.string().min(1),
  articleUrl: z.string().url(),
  articleTitle: z.string().min(1),
  articleSnippet: z.string(),
  articleSource: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  similarity: z.number().min(0).max(1),
})

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-news-indexer-secret')
  if (!env.NEWS_INDEXER_SECRET || !secret || secret !== env.NEWS_INDEXER_SECRET) {
    return apiError('Unauthorized', 401)
  }

  try {
    const body = bodySchema.parse(await request.json())

    const prediction = await prisma.prediction.findUnique({
      where: { id: body.predictionId },
      select: { id: true, claimText: true, status: true },
    })

    if (!prediction) return apiError('Prediction not found', 404)
    if (prediction.status !== 'ACTIVE') return apiError('Prediction is not active', 409)

    const article = {
      url: body.articleUrl,
      title: body.articleTitle,
      snippet: body.articleSnippet,
      source: body.articleSource ?? undefined,
      publishedDate: body.publishedAt ?? undefined,
    }

    const oracleForecast = await getOracleForecast(
      prediction.claimText,
      { articles: [article] },
      { source: 'news-indexer', predictionId: prediction.id },
    )

    let probability: number | null = null

    if (oracleForecast) {
      const toPercent = (v: number) => Math.round(((v + 1) / 2) * 100)
      probability = toPercent(oracleForecast.mean)
      const ciLow = toPercent(oracleForecast.ci_low)
      const ciHigh = toPercent(oracleForecast.ci_high)

      await saveNewsIndexerMatch({
        predictionId: prediction.id,
        articleUrl: body.articleUrl,
        articleTitle: body.articleTitle,
        articleSource: body.articleSource ?? null,
        publishedAt: body.publishedAt ?? null,
        externalProbability: probability,
        ciLow,
        ciHigh,
        oracleSnapshot: {
          mean: oracleForecast.mean,
          std: oracleForecast.std,
          ciLow,
          ciHigh,
          articlesUsed: oracleForecast.articles_used,
          sources: oracleForecast.sources.map(s => ({
            sourceId: s.source_id,
            sourceName: s.source_name,
            url: s.url,
            stance: s.stance,
            certainty: s.certainty,
            credibilityWeight: s.credibility_weight,
            claims: s.claims,
          })),
        },
      })

      log.info(
        { predictionId: prediction.id, probability, similarity: body.similarity },
        'news-indexer: oracle updated',
      )
    } else {
      log.info(
        { predictionId: prediction.id, similarity: body.similarity },
        'news-indexer: oracle returned null, skipping probability update',
      )
    }

    void notifyNewsArticleMatched(
      { id: prediction.id, claimText: prediction.claimText },
      { title: body.articleTitle, url: body.articleUrl, source: body.articleSource ?? null },
      body.similarity,
      probability,
    )

    // Return per-article Oracle output so news-indexer can store it in forecast_match.
    const firstSource = oracleForecast?.sources?.[0]
    return NextResponse.json({
      ok: true,
      stance: firstSource?.stance ?? null,
      certainty: firstSource?.certainty ?? null,
      claim: firstSource?.claims?.[0] ?? null,
      probability,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to process news-indexer context push')
  }
}
