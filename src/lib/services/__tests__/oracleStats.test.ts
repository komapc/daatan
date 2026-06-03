/**
 * @jest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    oracleCallLog: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { getOracleUsageStats } from '../oracleStats'
import { prisma } from '@/lib/prisma'

const mockGroupBy = vi.mocked(prisma.oracleCallLog.groupBy)
const mockAggregate = vi.mocked(prisma.oracleCallLog.aggregate)
const mockFindMany = vi.mocked(prisma.oracleCallLog.findMany)

const d = (s: string) => new Date(s)

beforeEach(() => {
  vi.clearAllMocks()
  // groupBy is called in order: bySource, byCallType, byEngine, byStatus
  mockGroupBy
    .mockResolvedValueOnce([
      { source: 'bot-voting', status: 'OK', _count: { _all: 3 }, _avg: { durationMs: 100 }, _max: { createdAt: d('2026-06-01') } },
      { source: 'bot-voting', status: 'ERROR', _count: { _all: 1 }, _avg: { durationMs: 50 }, _max: { createdAt: d('2026-06-02') } },
      { source: 'research', status: 'OK', _count: { _all: 2 }, _avg: { durationMs: 200 }, _max: { createdAt: d('2026-06-03') } },
    ] as never)
    .mockResolvedValueOnce([
      { callType: 'SEARCH', status: 'OK', _count: { _all: 5 }, _avg: { durationMs: 120 }, _max: { createdAt: d('2026-06-03') } },
    ] as never)
    .mockResolvedValueOnce([
      { searchEngine: 'gdelt', status: 'OK', _count: { _all: 4 }, _avg: { durationMs: 110 }, _max: { createdAt: d('2026-06-03') } },
      { searchEngine: null, status: 'OK', _count: { _all: 2 }, _avg: { durationMs: 90 }, _max: { createdAt: d('2026-06-01') } },
    ] as never)
    .mockResolvedValueOnce([
      { status: 'OK', _count: { _all: 6 } },
      { status: 'ERROR', _count: { _all: 1 } },
    ] as never)
  mockAggregate.mockResolvedValue({ _count: { _all: 7 }, _avg: { durationMs: 130 } } as never)
  mockFindMany.mockResolvedValue([
    { id: 'c1', callType: 'FORECAST', source: 'context-update', status: 'OK', durationMs: 300, createdAt: d('2026-06-03'), user: { name: 'A', username: 'a' } },
  ] as never)
})

describe('getOracleUsageStats', () => {
  it('computes totals from the status + aggregate rows', async () => {
    const stats = await getOracleUsageStats(7)
    expect(stats.windowDays).toBe(7)
    expect(stats.totals.totalCalls).toBe(7)
    expect(stats.totals.errorCalls).toBe(1)
    expect(stats.totals.errorRate).toBe(14) // round(1/7*100)
    expect(stats.totals.avgDurationMs).toBe(130)
  })

  it('folds [dimension, status] groups into per-key breakdowns, sorted by call count', async () => {
    const stats = await getOracleUsageStats()
    // bot-voting: 3 OK + 1 ERROR = 4 calls, 1 error, weighted avg (100*3 + 50*1)/4 = 87.5 -> 88
    expect(stats.bySource[0]).toEqual({
      key: 'bot-voting', callCount: 4, errorCount: 1, avgDurationMs: 88, lastSeenAt: d('2026-06-02'),
    })
    expect(stats.bySource[1].key).toBe('research')
    expect(stats.bySource[1].errorCount).toBe(0)
  })

  it('renders a null search engine as the "—" bucket', async () => {
    const stats = await getOracleUsageStats()
    expect(stats.byEngine.map(b => b.key)).toContain('—')
    expect(stats.byEngine.map(b => b.key)).toContain('gdelt')
  })

  it('returns the recent calls with their attributed user', async () => {
    const stats = await getOracleUsageStats()
    expect(stats.recent).toHaveLength(1)
    expect(stats.recent[0].user).toEqual({ name: 'A', username: 'a' })
  })
})
