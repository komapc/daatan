/**
 * Unit tests for findSimilarForecasts — Jaccard similarity + tag-gated DB query.
 *
 * Strategy: mock prisma to return canned candidates, verify that only results
 * above the Jaccard threshold are returned and that ranking is correct.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    prediction: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCandidate(claimText: string, tags: string[] = [], id = claimText.slice(0, 8)) {
  return {
    id,
    slug: id,
    claimText,
    status: 'ACTIVE',
    resolveByDatetime: new Date('2027-01-01'),
    author: { name: 'Alice', username: 'alice' },
    tags: tags.map(name => ({ name })),
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('findSimilarForecasts — Jaccard filtering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when no candidates exceed the threshold', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { findSimilarForecasts } = await import('@/lib/services/forecast')

    // Completely unrelated candidate
    vi.mocked(prisma.prediction.findMany).mockResolvedValue([
      makeCandidate('The moon landing anniversary celebrations begin') as any,
    ])

    const results = await findSimilarForecasts({
      claimText: 'Bitcoin will exceed one hundred thousand dollars by year end',
      tags: ['crypto'],
    })

    expect(results).toHaveLength(0)
  })

  it('returns a highly similar forecast above threshold', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { findSimilarForecasts } = await import('@/lib/services/forecast')

    vi.mocked(prisma.prediction.findMany).mockResolvedValue([
      makeCandidate('Bitcoin price will surpass one hundred thousand dollars this year', ['crypto']) as any,
    ])

    const results = await findSimilarForecasts({
      claimText: 'Bitcoin will exceed one hundred thousand dollars by year end',
      tags: ['crypto'],
    })

    expect(results).toHaveLength(1)
    expect(results[0].score).toBeGreaterThanOrEqual(0.15)
    expect(results[0].claimText).toContain('Bitcoin')
  })

  it('ranks higher-Jaccard result first', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { findSimilarForecasts } = await import('@/lib/services/forecast')

    vi.mocked(prisma.prediction.findMany).mockResolvedValue([
      // moderate overlap: shares bitcoin, hundred, thousand, dollars
      makeCandidate('Bitcoin price will exceed hundred thousand dollars this quarter', ['crypto'], 'id-low') as any,
      // higher overlap: shares bitcoin, exceed, hundred, thousand, dollars, year
      makeCandidate('Bitcoin price will exceed one hundred thousand dollars in year 2026', ['crypto'], 'id-high') as any,
    ])

    const results = await findSimilarForecasts({
      claimText: 'Bitcoin will exceed one hundred thousand dollars by year end',
      tags: ['crypto'],
      limit: 2,
    })

    expect(results.length).toBe(2)
    expect(results[0].id).toBe('id-high')
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
  })

  it('uses shared tag count as a tiebreaker when Jaccard scores are equal', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { findSimilarForecasts } = await import('@/lib/services/forecast')

    // Both candidates have identical claimText (equal Jaccard) but different tag overlap
    const identicalClaim = 'Will the Federal Reserve cut interest rates before December'
    vi.mocked(prisma.prediction.findMany).mockResolvedValue([
      makeCandidate(identicalClaim, ['economy'], 'id-1tag') as any,
      makeCandidate(identicalClaim, ['economy', 'finance', 'usa'], 'id-3tags') as any,
    ])

    const results = await findSimilarForecasts({
      claimText: identicalClaim,
      tags: ['economy', 'finance'],
      limit: 2,
    })

    expect(results[0].id).toBe('id-3tags')
  })

  it('respects limit parameter', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { findSimilarForecasts } = await import('@/lib/services/forecast')

    vi.mocked(prisma.prediction.findMany).mockResolvedValue([
      makeCandidate('Bitcoin price will exceed one hundred thousand dollars', ['crypto'], 'a') as any,
      makeCandidate('Bitcoin will reach one hundred thousand in 2026', ['crypto'], 'b') as any,
      makeCandidate('Bitcoin surpasses hundred thousand dollar mark', ['crypto'], 'c') as any,
      makeCandidate('Bitcoin one hundred thousand dollar milestone this year', ['crypto'], 'd') as any,
    ])

    const results = await findSimilarForecasts({
      claimText: 'Bitcoin will exceed one hundred thousand dollars by year end',
      tags: ['crypto'],
      limit: 2,
    })

    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('excludes the forecast with excludeId', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { findSimilarForecasts } = await import('@/lib/services/forecast')

    // Prisma enforces excludeId via where clause — verify the where is built correctly
    vi.mocked(prisma.prediction.findMany).mockResolvedValue([])

    await findSimilarForecasts({
      claimText: 'Bitcoin will exceed one hundred thousand dollars',
      tags: ['crypto'],
      excludeId: 'self-id',
    })

    const whereArg = vi.mocked(prisma.prediction.findMany).mock.calls[0][0]?.where as any
    expect(whereArg.id).toEqual({ not: 'self-id' })
  })

  it('falls back to keyword OR query when no tags provided', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { findSimilarForecasts } = await import('@/lib/services/forecast')

    vi.mocked(prisma.prediction.findMany).mockResolvedValue([])

    await findSimilarForecasts({
      claimText: 'Bitcoin will exceed one hundred thousand dollars by year end',
      tags: [],
    })

    const whereArg = vi.mocked(prisma.prediction.findMany).mock.calls[0][0]?.where as any
    // No tag filter; should have OR array of keyword contains clauses
    expect(whereArg.tags).toBeUndefined()
    expect(Array.isArray(whereArg.OR)).toBe(true)
    expect(whereArg.OR.length).toBeGreaterThan(0)
    expect(whereArg.OR[0].claimText).toBeDefined()
  })

  it('returns empty array immediately when both claimText and tags are empty', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { findSimilarForecasts } = await import('@/lib/services/forecast')

    const results = await findSimilarForecasts({ claimText: '   ', tags: [] })

    expect(results).toHaveLength(0)
    expect(prisma.prediction.findMany).not.toHaveBeenCalled()
  })
})
