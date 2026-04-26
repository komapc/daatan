import { prisma } from '@/lib/prisma'
import { hashUrl } from '@/lib/utils/hash'

export interface NewsAnchorSearchParams {
  url?: string
  search?: string
  limit?: number
}

export async function searchNewsAnchors({ url, search, limit = 20 }: NewsAnchorSearchParams) {
  const where: Record<string, unknown> = {}
  if (url) where.urlHash = hashUrl(url)
  if (search) where.title = { contains: search, mode: 'insensitive' }

  return prisma.newsAnchor.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    include: { _count: { select: { predictions: true } } },
  })
}

export interface NewsAnchorInput {
  url: string
  title: string
  source?: string
  publishedAt?: string | null
  snippet?: string
  imageUrl?: string
}

export async function getOrCreateNewsAnchor(data: NewsAnchorInput) {
  const urlHash = hashUrl(data.url)
  const existing = await prisma.newsAnchor.findUnique({
    where: { urlHash },
    include: { _count: { select: { predictions: true } } },
  })

  if (existing) return { ...existing, isExisting: true }

  const created = await prisma.newsAnchor.create({
    data: {
      url: data.url,
      urlHash,
      title: data.title,
      source: data.source,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      snippet: data.snippet,
      imageUrl: data.imageUrl,
    },
    include: { _count: { select: { predictions: true } } },
  })

  return { ...created, isExisting: false }
}
