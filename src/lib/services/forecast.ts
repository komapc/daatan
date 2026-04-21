import crypto from 'crypto'
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

    const options = (pred as any).options?.map((opt: any) => ({
      ...opt,
      commitmentsCount: commitments
        ? commitments.filter((c) => c.optionId === opt.id).length
        : 0,
    })) || []

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
          outcomeType: input.outcomeType as any,
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

  // Fetch candidates: ACTIVE forecasts sharing at least 1 tag OR matching a keyword
  const candidates = await prisma.prediction.findMany({
    where: {
      status: 'ACTIVE',
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        ...(tags.length > 0 ? [{ tags: { some: { name: { in: tags } } } }] : []),
        ...(keywords.length > 0 ? [{ claimText: { contains: keywords[0], mode: 'insensitive' as const } }] : []),
      ],
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
    take: 50,
  })

  // Score each candidate
  const scored = candidates.map(c => {
    const candidateTags = new Set(c.tags.map(t => t.name.toLowerCase()))
    const sharedTags = tags.filter(t => candidateTags.has(t.toLowerCase())).length

    const candidateKeywords = new Set(extractKeywords(c.claimText))
    const sharedKeywords = keywords.filter(k => candidateKeywords.has(k)).length

    return {
      ...c,
      score: sharedTags * 3 + sharedKeywords,
    }
  })

  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ tags: _, ...rest }) => rest)
}
