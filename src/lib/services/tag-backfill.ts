import { prisma } from '@/lib/prisma'
import { suggestTags } from '@/lib/llm/gemini'
import { slugify } from '@/lib/utils/slugify'
import { createLogger } from '@/lib/logger'

const log = createLogger('tag-backfill')

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

export interface BackfillTagsItem {
  id: string
  claimText: string
  tags: string[]
}

export interface BackfillTagsResult {
  dryRun: boolean
  /** Forecasts examined in this batch. */
  scanned: number
  /** Forecasts that received (or, in dry-run, would receive) tags. */
  updated: number
  /** Forecasts the LLM could not tag (empty suggestion). */
  skipped: number
  /** Cursor to pass to the next call, or null when the scan is complete. */
  nextCursor: string | null
  /** Total forecasts still carrying zero tags (computed before this batch). */
  totalUntagged: number
  items: BackfillTagsItem[]
}

/**
 * Assign LLM-suggested topic tags to forecasts that currently have none.
 *
 * Cursor-paginated by ascending id so each call is bounded and forecasts the
 * LLM can't tag aren't re-examined on the next call. In dry-run mode no writes
 * happen — the proposed tags are returned for review.
 */
export async function backfillForecastTags(opts: {
  dryRun: boolean
  limit?: number
  cursor?: string
}): Promise<BackfillTagsResult> {
  const dryRun = opts.dryRun
  const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIMIT))

  const totalUntagged = await prisma.prediction.count({ where: { tags: { none: {} } } })

  const forecasts = await prisma.prediction.findMany({
    where: {
      tags: { none: {} },
      ...(opts.cursor ? { id: { gt: opts.cursor } } : {}),
    },
    orderBy: { id: 'asc' },
    take: limit,
    select: { id: true, claimText: true, detailsText: true },
  })

  const items: BackfillTagsItem[] = []
  let updated = 0
  let skipped = 0

  for (const forecast of forecasts) {
    const tagNames = await suggestTags(forecast.claimText, forecast.detailsText ?? undefined)

    if (tagNames.length === 0) {
      skipped++
      continue
    }

    if (!dryRun) {
      await prisma.prediction.update({
        where: { id: forecast.id },
        data: {
          tags: {
            connectOrCreate: tagNames.map((name: string) => {
              const slug = slugify(name)
              return { where: { slug }, create: { name, slug } }
            }),
          },
        },
      })
    }

    updated++
    items.push({ id: forecast.id, claimText: forecast.claimText, tags: tagNames })
  }

  const nextCursor = forecasts.length === limit ? forecasts[forecasts.length - 1].id : null

  log.info({ dryRun, scanned: forecasts.length, updated, skipped, nextCursor, totalUntagged }, 'Tag backfill batch')

  return {
    dryRun,
    scanned: forecasts.length,
    updated,
    skipped,
    nextCursor,
    totalUntagged,
    items,
  }
}
