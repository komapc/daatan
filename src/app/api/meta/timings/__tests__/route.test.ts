import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    contextTiming: {
      aggregate: vi.fn(),
    },
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { GET } from '../route'

describe('GET /api/meta/timings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns defaults when fewer than 3 samples exist', async () => {
    mockPrisma.contextTiming.aggregate.mockResolvedValue({
      _avg: { searchMs: null, llmMs: null, oracleMs: null },
      _count: { id: 2 },
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.hasData).toBe(false)
    expect(data.timings).toEqual({ searchMs: 10_000, llmMs: 12_000, oracleMs: 8_000 })
  })

  it('returns defaults when avg is null (no rows in window)', async () => {
    mockPrisma.contextTiming.aggregate.mockResolvedValue({
      _avg: { searchMs: null, llmMs: null, oracleMs: null },
      _count: { id: 0 },
    })

    const res = await GET()
    const data = await res.json()
    expect(data.hasData).toBe(false)
  })

  it('returns averaged timings when ≥ 3 samples exist', async () => {
    mockPrisma.contextTiming.aggregate.mockResolvedValue({
      _avg: { searchMs: 9_800.4, llmMs: 11_200.7, oracleMs: 7_400.1 },
      _count: { id: 42 },
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.hasData).toBe(true)
    expect(data.sampleCount).toBe(42)
    expect(data.timings.searchMs).toBe(9_800)
    expect(data.timings.llmMs).toBe(11_201)
    expect(data.timings.oracleMs).toBe(7_400)
  })

  it('queries only within the 30-day window', async () => {
    mockPrisma.contextTiming.aggregate.mockResolvedValue({
      _avg: { searchMs: 8_000, llmMs: 10_000, oracleMs: 6_000 },
      _count: { id: 10 },
    })

    await GET()

    const call = mockPrisma.contextTiming.aggregate.mock.calls[0][0]
    expect(call.where?.createdAt?.gte).toBeInstanceOf(Date)
    const windowMs = Date.now() - call.where.createdAt.gte.getTime()
    expect(windowMs).toBeLessThan(30 * 24 * 60 * 60 * 1000 + 5_000)
    expect(windowMs).toBeGreaterThan(30 * 24 * 60 * 60 * 1000 - 5_000)
  })
})
