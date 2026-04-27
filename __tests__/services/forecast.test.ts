/**
 * TEST-7: createForecast slug collision retry exhaustion.
 * The retry loop in createForecast attempts up to 3 times when Prisma throws
 * a P2002 unique constraint on the slug. After all attempts are exhausted,
 * it should throw 'Failed to generate a unique URL slug after multiple attempts'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    prediction: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    predictionOption: {
      createMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

const baseInput = {
  authorId: 'author-1',
  claimText: 'Bitcoin will exceed one hundred thousand dollars by year end',
  outcomeType: 'BINARY',
  resolveByDatetime: '2026-12-31T23:59:59Z',
  resolutionRules: 'Resolves YES if CoinMarketCap shows BTC > $100k on resolution date.',
}

describe('createForecast — slug collision retry exhaustion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws after all 3 retry attempts fail with P2002 slug collision', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { createForecast } = await import('@/lib/services/forecast')

    vi.mocked(prisma.prediction.findMany).mockResolvedValue([])

    const slugError = Object.assign(new Error('Unique constraint'), {
      code: 'P2002',
      meta: { target: ['slug'] },
    })
    vi.mocked(prisma.prediction.create).mockRejectedValue(slugError)

    await expect(createForecast(baseInput)).rejects.toThrow(
      'Failed to generate a unique URL slug after multiple attempts',
    )
    // All 3 attempts were made
    expect(prisma.prediction.create).toHaveBeenCalledTimes(3)
  })

  it('succeeds on the second attempt after the first slug is taken', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { createForecast } = await import('@/lib/services/forecast')

    vi.mocked(prisma.prediction.findMany).mockResolvedValue([])

    const slugError = Object.assign(new Error('Unique constraint'), {
      code: 'P2002',
      meta: { target: ['slug'] },
    })
    vi.mocked(prisma.prediction.create)
      .mockRejectedValueOnce(slugError)
      .mockResolvedValueOnce({ id: 'pred-retry-ok' } as any)

    // createForecast ends with a findUnique to return the full record
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue({ id: 'pred-retry-ok', claimText: baseInput.claimText } as any)

    const result = await createForecast(baseInput)

    expect(result).toMatchObject({ id: 'pred-retry-ok' })
    expect(prisma.prediction.create).toHaveBeenCalledTimes(2)
  })

  it('re-throws immediately for non-slug Prisma errors (no retry)', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { createForecast } = await import('@/lib/services/forecast')

    vi.mocked(prisma.prediction.findMany).mockResolvedValue([])

    const dbError = Object.assign(new Error('Foreign key violation'), {
      code: 'P2003',
      meta: { field_name: 'authorId' },
    })
    vi.mocked(prisma.prediction.create).mockRejectedValue(dbError)

    await expect(createForecast(baseInput)).rejects.toThrow('Foreign key violation')
    // Only 1 attempt — no retry for non-slug errors
    expect(prisma.prediction.create).toHaveBeenCalledTimes(1)
  })
})
