import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    commitment: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

describe('getGlickoHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when user has no resolved predictions', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getGlickoHistory } = await import('@/lib/services/expertise')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([])

    const result = await getGlickoHistory('user-1')
    expect(result).toEqual([])
  })

  it('returns one data point per resolved commitment', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getGlickoHistory } = await import('@/lib/services/expertise')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      { brierScore: 0.1, prediction: { resolvedAt: new Date('2026-01-01') } },
      { brierScore: 0.3, prediction: { resolvedAt: new Date('2026-02-01') } },
    ] as any)

    const result = await getGlickoHistory('user-1')
    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2026-01-01')
    expect(result[1].date).toBe('2026-02-01')
  })

  it('sigma (uncertainty) shrinks or stays stable as predictions accumulate', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getGlickoHistory } = await import('@/lib/services/expertise')

    // 6 predictions with consistent good performance — sigma should not grow
    const rows = Array.from({ length: 6 }, (_, i) => ({
      brierScore: 0.1,
      prediction: { resolvedAt: new Date(`2026-0${i + 1}-01`) },
    }))
    vi.mocked(prisma.commitment.findMany).mockResolvedValue(rows as any)

    const result = await getGlickoHistory('user-1')
    expect(result).toHaveLength(6)
    // sigma should not be larger at the end than the start
    expect(result[result.length - 1].sigma).toBeLessThanOrEqual(result[0].sigma)
  })

  it('passes tagSlug filter to prisma query', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getGlickoHistory } = await import('@/lib/services/expertise')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([])

    await getGlickoHistory('user-1', 'economics')

    const call = vi.mocked(prisma.commitment.findMany).mock.calls[0]?.[0]
    expect(JSON.stringify(call?.where)).toContain('economics')
  })

  it('does not include tag filter when tagSlug is undefined', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getGlickoHistory } = await import('@/lib/services/expertise')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([])

    await getGlickoHistory('user-1')

    const call = vi.mocked(prisma.commitment.findMany).mock.calls[0]?.[0]
    expect(JSON.stringify(call?.where)).not.toContain('tags')
  })

  it('returns data points with rounded mu and sigma values', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { getGlickoHistory } = await import('@/lib/services/expertise')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      { brierScore: 0.25, prediction: { resolvedAt: new Date('2026-03-15') } },
    ] as any)

    const result = await getGlickoHistory('user-1')
    expect(Number.isInteger(result[0].mu)).toBe(true)
    expect(Number.isInteger(result[0].sigma)).toBe(true)
  })
})
