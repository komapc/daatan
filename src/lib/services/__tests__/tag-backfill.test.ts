import { describe, it, expect, vi, beforeEach } from 'vitest'
import { backfillForecastTags } from '../tag-backfill'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    prediction: {
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/llm/gemini', () => ({
  suggestTags: vi.fn(),
}))

vi.mock('@/lib/utils/slugify', () => ({
  slugify: (s: string) => s.toLowerCase().replace(/\s+/g, '-'),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import { prisma } from '@/lib/prisma'
import { suggestTags } from '@/lib/llm/gemini'

const mockCount = vi.mocked(prisma.prediction.count)
const mockFindMany = vi.mocked(prisma.prediction.findMany)
const mockUpdate = vi.mocked(prisma.prediction.update)
const mockSuggest = vi.mocked(suggestTags)

beforeEach(() => {
  vi.clearAllMocks()
  mockCount.mockResolvedValue(2 as never)
})

describe('backfillForecastTags', () => {
  it('dry-run proposes tags but writes nothing', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'p1', claimText: 'Bitcoin to 100k', detailsText: null },
    ] as never)
    mockSuggest.mockResolvedValue(['Crypto', 'Finance'] as never)

    const res = await backfillForecastTags({ dryRun: true })

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(res.updated).toBe(1)
    expect(res.skipped).toBe(0)
    expect(res.items[0]).toEqual({ id: 'p1', claimText: 'Bitcoin to 100k', tags: ['Crypto', 'Finance'] })
  })

  it('real run connectOrCreates the suggested tags by slug', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'p1', claimText: 'Election outcome', detailsText: 'context' },
    ] as never)
    mockSuggest.mockResolvedValue(['World Politics'] as never)

    const res = await backfillForecastTags({ dryRun: false })

    expect(res.updated).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        tags: {
          connectOrCreate: [
            { where: { slug: 'world-politics' }, create: { name: 'World Politics', slug: 'world-politics' } },
          ],
        },
      },
    })
  })

  it('skips forecasts the LLM returns no tags for', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'p1', claimText: 'Untaggable', detailsText: null },
    ] as never)
    mockSuggest.mockResolvedValue([] as never)

    const res = await backfillForecastTags({ dryRun: false })

    expect(res.skipped).toBe(1)
    expect(res.updated).toBe(0)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns nextCursor when the batch is full, null otherwise', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'a', claimText: 'one', detailsText: null },
      { id: 'b', claimText: 'two', detailsText: null },
    ] as never)
    mockSuggest.mockResolvedValue(['Tag'] as never)

    const full = await backfillForecastTags({ dryRun: true, limit: 2 })
    expect(full.nextCursor).toBe('b')

    const partial = await backfillForecastTags({ dryRun: true, limit: 5 })
    expect(partial.nextCursor).toBeNull()
  })
})
