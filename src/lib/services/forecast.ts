import crypto from 'crypto'
import type { OutcomeType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { slugify, generateUniqueSlug } from '@/lib/utils/slugify'
import { hashUrl } from '@/lib/utils/hash'

const PREDICTION_AUTHOR_SELECT = {
  id: true,
  name: true,
  username: true,
  image: true,
  rs: true,
  role: true,
} as const

const NEWS_ANCHOR_SELECT = {
  id: true,
  title: true,
  url: true,
  source: true,
  imageUrl: true,
} as const

export interface ListForecastsQuery {
  where: Record<string, unknown>
  orderBy: Record<string, 'asc' | 'desc'>
  page: number
  limit: number
  isCuSort: boolean
  sortOrder: 'asc' | 'desc'
}

export async function listForecasts(query: ListForecastsQuery) {
  const [predictions, total] = await Promise.all([
    prisma.prediction.findMany({
      where: query.where,
      include: {
        author: { select: PREDICTION_AUTHOR_SELECT },
        newsAnchor: { select: NEWS_ANCHOR_SELECT },
        tags: { select: { name: true } },
        options: { orderBy: { displayOrder: 'asc' } },
        _count: { select: { commitments: true } },
        commitments: {
          select: {
            cuCommitted: true,
            userId: true,
            binaryChoice: true,
            optionId: true,
          },
        },
      },
      orderBy: query.orderBy,
      skip: query.isCuSort ? 0 : (query.page - 1) * query.limit,
      take: query.isCuSort ? 200 : query.limit,
    }),
    prisma.prediction.count({ where: query.where }),
  ])
  return { predictions, total }
}

export function enrichPredictions(
  predictions: Awaited<ReturnType<typeof listForecasts>>['predictions'],
  userId: string | undefined,
  query: Pick<ListForecastsQuery, 'page' | 'limit' | 'sortOrder' | 'isCuSort'>,
) {
  const enriched = predictions.map(({ commitments, ...pred }) => {
    const totalCuCommitted = commitments
      ? commitments.reduce((sum, c) => sum + c.cuCommitted, 0)
      : 0
    const userHasCommitted = userId && commitments
      ? commitments.some((c) => c.userId === userId)
      : false

    let yesCount = 0
    let noCount = 0
    if (pred.outcomeType === 'BINARY' && commitments) {
      yesCount = commitments
        .filter(c => c.binaryChoice === true)
        .reduce((sum, c) => sum + c.cuCommitted, 0)
      noCount = commitments
        .filter(c => c.binaryChoice === false)
        .reduce((sum, c) => sum + Math.abs(c.cuCommitted), 0)
    }

    const options = pred.options?.map((opt) => ({
      ...opt,
      commitmentsCount: commitments
        ? commitments.filter((c) => c.optionId === opt.id).length
        : 0,
    })) ?? []

    return { ...pred, totalCuCommitted, userHasCommitted, yesCount, noCount, options }
  })

  if (!query.isCuSort) return enriched

  return enriched
    .sort((a, b) =>
      query.sortOrder === 'asc'
        ? a.totalCuCommitted - b.totalCuCommitted
        : b.totalCuCommitted - a.totalCuCommitted,
    )
    .slice((query.page - 1) * query.limit, query.page * query.limit)
}

export async function upsertNewsAnchor(url: string, title?: string) {
  const urlHash = hashUrl(url)
  return prisma.newsAnchor.upsert({
    where: { urlHash },
    update: {},
    create: {
      url,
      urlHash,
      title: title || url,
      source: new URL(url).hostname.replace('www.', ''),
    },
  })
}

export async function verifyUserExists(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
}

export interface CreateForecastInput {
  authorId: string
  claimText: string
  detailsText?: string
  outcomeType: string
  outcomePayload?: Record<string, unknown>
  resolutionRules?: string
  resolveByDatetime: string
  isPublic?: boolean
  source?: string | null
  confidence?: number | null
  newsAnchorId?: string
  tags?: string[]
}

export async function createForecast(input: CreateForecastInput) {
  const shareToken = crypto.randomBytes(8).toString('hex')
  const baseSlug = slugify(input.claimText)

  const existingSlugs = await prisma.prediction
    .findMany({
      where: { slug: { startsWith: baseSlug } },
      select: { slug: true },
    })
    .then(rows => rows.map(r => r.slug).filter((s): s is string => s !== null))

  let uniqueSlug = generateUniqueSlug(baseSlug, existingSlugs)
  let prediction: { id: string } | null = null
  let retries = 0

  while (retries < 3) {
    try {
      prediction = await prisma.prediction.create({
        data: {
          authorId: input.authorId,
          newsAnchorId: input.newsAnchorId,
          claimText: input.claimText,
          slug: uniqueSlug,
          detailsText: input.detailsText,
          outcomeType: input.outcomeType as OutcomeType,
          outcomePayload: (input.outcomePayload ?? {}) as object,
          resolutionRules: input.resolutionRules,
          resolveByDatetime: new Date(input.resolveByDatetime),
          status: 'DRAFT',
          isPublic: input.isPublic ?? true,
          source: input.source ?? null,
          confidence: input.confidence ?? null,
          shareToken,
          tags: input.tags?.length
            ? {
              connectOrCreate: input.tags
                .filter((t): t is string => typeof t === 'string' && t.length > 0)
                .map((tagName) => {
                  const tagSlug = slugify(tagName)
                  return { where: { slug: tagSlug }, create: { name: tagName, slug: tagSlug } }
                }),
            }
            : undefined,
        },
        select: { id: true },
      })
      break
    } catch (err: any) {
      if (err.code === 'P2002' && err.meta?.target?.includes('slug')) {
        retries++
        uniqueSlug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`
        continue
      }
      throw err
    }
  }

  if (!prediction) throw new Error('Failed to generate a unique URL slug after multiple attempts')

  if (input.outcomeType === 'MULTIPLE_CHOICE') {
    const payload = input.outcomePayload as { options?: string[] } | undefined
    if (payload?.options?.length) {
      await prisma.predictionOption.createMany({
        data: payload.options.map((text, index) => ({
          predictionId: prediction!.id,
          text,
          displayOrder: index,
        })),
      })
    }
  }

  return prisma.prediction.findUnique({
    where: { id: prediction.id },
    include: {
      author: { select: { id: true, name: true, username: true, image: true } },
      newsAnchor: true,
      options: { orderBy: { displayOrder: 'asc' } },
    },
  })
}

// ── Similar forecasts ──────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the','a','an','will','would','should','could','may','might','by','of','end',
  'to','in','on','at','and','or','be','is','are','was','were','that','this',
  'it','its','have','has','had','do','does','did','not','for','with','from',
  'up','about','into','than','then','so','if','as','over','under','between',
])

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
}

/**
 * Jaccard similarity between two keyword sets: |A∩B| / |A∪B|.
 * Returns 0 when both sets are empty.
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const w of a) if (b.has(w)) intersection++
  const union = a.size + b.size - intersection
  return intersection / union
}

// Minimum Jaccard similarity to be considered "similar".
// 0.15 means roughly 1 shared keyword out of 5–7 total unique keywords.
const JACCARD_THRESHOLD = 0.15

export interface SimilarForecast {
  id: string
  slug: string | null
  claimText: string
  status: string
  resolveByDatetime: Date
  author: { name: string | null; username: string | null }
  score: number
}

export async function findSimilarForecasts({
  claimText,
  tags,
  excludeId,
  limit = 3,
}: {
  claimText: string
  tags: string[]
  excludeId?: string
  limit?: number
}): Promise<SimilarForecast[]> {
  const keywords = extractKeywords(claimText)
  if (keywords.length === 0 && tags.length === 0) return []

  // Fetch candidates: require at least 1 shared tag when tags are available,
  // otherwise fall back to a multi-keyword OR search. This prunes the candidate
  // set at the DB level so Jaccard only runs on topically adjacent forecasts.
  const candidates = await prisma.prediction.findMany({
    where: {
      status: { in: ['ACTIVE', 'PENDING_APPROVAL'] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(tags.length > 0
        ? { tags: { some: { name: { in: tags } } } }
        : {
            OR: keywords.slice(0, 5).map(k => ({
              claimText: { contains: k, mode: 'insensitive' as const },
            })),
          }),
    },
    select: {
      id: true,
      slug: true,
      claimText: true,
      status: true,
      resolveByDatetime: true,
      author: { select: { name: true, username: true } },
      tags: { select: { name: true } },
    },
    take: 100,
  })

  const queryKws = new Set(keywords)

  return candidates
    .map(c => {
      const candidateKws = new Set(extractKeywords(c.claimText))
      const similarity = jaccard(queryKws, candidateKws)

      // Shared tag count used only as a tiebreaker, not to inflate score
      const candidateTags = new Set(c.tags.map((t: { name: string }) => t.name.toLowerCase()))
      const sharedTags = tags.filter(t => candidateTags.has(t.toLowerCase())).length

      return {
        id: c.id,
        slug: c.slug,
        claimText: c.claimText,
        status: c.status,
        resolveByDatetime: c.resolveByDatetime,
        author: c.author,
        score: similarity,
        sharedTags,
      }
    })
    .filter(c => c.score >= JACCARD_THRESHOLD)
    .sort((a, b) => b.score - a.score || b.sharedTags - a.sharedTags)
    .slice(0, limit)
    .map(({ sharedTags: _, ...rest }) => rest)
}

// ── Single forecast ───────────────────────────────────────────────────────────

export async function getForecastById(idOrSlug: string) {
  return prisma.prediction.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      author: { select: { id: true, name: true, username: true, image: true, rs: true, role: true, isBot: true } },
      newsAnchor: true,
      options: { orderBy: { displayOrder: 'asc' } },
      commitments: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
          option: { select: { id: true, text: true } },
        },
      },
      _count: { select: { commitments: true } },
    },
  })
}

export async function getPredictionOwnershipInfo(id: string) {
  return prisma.prediction.findUnique({
    where: { id },
    select: { authorId: true, status: true, lockedAt: true },
  })
}

export async function getPredictionBasicInfo(id: string) {
  return prisma.prediction.findUnique({
    where: { id },
    select: { id: true, claimText: true, authorId: true, slug: true },
  })
}

export async function getPredictionWithTags(id: string) {
  return prisma.prediction.findUnique({
    where: { id },
    select: { claimText: true, tags: { select: { name: true } } },
  })
}

export async function getUserCommitment(predictionId: string, userId: string) {
  return prisma.commitment.findFirst({
    where: { predictionId, userId },
    select: {
      id: true,
      cuCommitted: true,
      binaryChoice: true,
      optionId: true,
      createdAt: true,
      rsChange: true,
      brierScore: true,
      option: { select: { id: true, text: true } },
    },
  })
}

export interface UpdateForecastData {
  claimText?: string
  detailsText?: string | null
  resolutionRules?: string | null
  resolveByDatetime?: string
  isPublic?: boolean
  options?: string[]
}

export async function updateForecast(id: string, data: UpdateForecastData) {
  const translatableFieldsChanged =
    data.claimText || data.detailsText !== undefined || data.resolutionRules !== undefined
  if (translatableFieldsChanged) {
    await prisma.predictionTranslation.deleteMany({ where: { predictionId: id } })
  }

  return prisma.$transaction(async (tx) => {
    if (data.options) {
      await tx.predictionOption.deleteMany({ where: { predictionId: id } })
      await tx.predictionOption.createMany({
        data: data.options.map((text, index) => ({ predictionId: id, text, displayOrder: index })),
      })
    }

    return tx.prediction.update({
      where: { id },
      data: {
        claimText: data.claimText,
        detailsText: data.detailsText,
        resolutionRules: data.resolutionRules,
        resolveByDatetime: data.resolveByDatetime ? new Date(data.resolveByDatetime) : undefined,
        isPublic: data.isPublic,
      },
      include: {
        author: { select: { id: true, name: true, username: true, image: true } },
        newsAnchor: true,
        options: { orderBy: { displayOrder: 'asc' } },
      },
    })
  })
}

export async function deleteForecast(id: string) {
  return prisma.prediction.delete({ where: { id } })
}

export async function publishForecast(id: string) {
  const now = new Date()
  return prisma.prediction.update({
    where: { id },
    data: { status: 'ACTIVE', publishedAt: now },
    include: {
      author: { select: { id: true, name: true, username: true, image: true } },
      newsAnchor: true,
      options: { orderBy: { displayOrder: 'asc' } },
    },
  })
}

export async function approveForecast(predictionId: string) {
  const now = new Date()
  return prisma.prediction.update({
    where: { id: predictionId },
    data: { status: 'ACTIVE', publishedAt: now },
    include: {
      author: { select: { id: true, name: true, username: true, image: true, isBot: true } },
      options: { orderBy: { displayOrder: 'asc' } },
    },
  })
}

export interface RejectForecastOptions {
  keywords: string[]
  description: string
  rejectorId: string
  authorId: string
}

export async function rejectForecast(predictionId: string, opts: RejectForecastOptions) {
  const now = new Date()
  const updated = await prisma.prediction.update({
    where: { id: predictionId },
    data: {
      status: 'VOID',
      resolutionOutcome: 'void',
      resolvedAt: now,
      resolutionNote: 'Rejected during approval workflow',
    },
    include: { author: { select: { id: true, name: true, username: true } } },
  })

  const botConfig = await prisma.botConfig.findUnique({ where: { userId: opts.authorId } })
  if (botConfig) {
    await prisma.botRejectedTopic.create({
      data: {
        botId: botConfig.id,
        keywords: opts.keywords,
        description: opts.description,
        rejectedById: opts.rejectorId,
      },
    })
  }

  return updated
}

export async function updateForecastStatus(id: string, status: string) {
  return prisma.prediction.update({
    where: { id },
    data: { status: status as 'DRAFT' | 'ACTIVE' | 'PENDING' | 'PENDING_APPROVAL' | 'RESOLVED_CORRECT' | 'RESOLVED_WRONG' | 'VOID' | 'UNRESOLVABLE' },
  })
}

// ── Admin queries ─────────────────────────────────────────────────────────────

export interface AdminForecastsQuery {
  search?: string
  page: number
  limit: number
}

export async function listAdminForecasts({ search, page, limit }: AdminForecastsQuery) {
  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { claimText: { contains: search, mode: 'insensitive' } },
      { author: { name: { contains: search, mode: 'insensitive' } } },
      { author: { email: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [predictions, total] = await Promise.all([
    prisma.prediction.findMany({
      where,
      include: {
        author: { select: { name: true, email: true } },
        _count: { select: { commitments: true, comments: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.prediction.count({ where }),
  ])

  return { predictions, total, pages: Math.ceil(total / limit) }
}

export async function listPendingApprovals({ page, limit }: { page: number; limit: number }) {
  const where = { status: 'PENDING_APPROVAL' as const }
  const [predictions, total] = await Promise.all([
    prisma.prediction.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, username: true, email: true, image: true, isBot: true } },
        _count: { select: { commitments: true, comments: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.prediction.count({ where }),
  ])

  return { predictions, total, pages: Math.ceil(total / limit) }
}

/** Fetch a prediction with its options — for the research route. */
export async function getForecastForResearch(id: string) {
  return prisma.prediction.findUnique({
    where: { id },
    include: { options: true },
  })
}

/** Find predictions that are missing resolution rules — for the backfill-rules admin route. */
export async function findPredictionsWithoutRules() {
  return prisma.prediction.findMany({
    where: { resolutionRules: null },
    select: { id: true, claimText: true, detailsText: true, outcomeType: true },
    orderBy: { createdAt: 'asc' },
  })
}

/** Set resolution rules on a single prediction — for the backfill-rules admin route. */
export async function updateForecastResolutionRules(id: string, rules: string) {
  return prisma.prediction.update({
    where: { id },
    data: { resolutionRules: rules },
  })
}
