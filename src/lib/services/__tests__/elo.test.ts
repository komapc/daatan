import { describe, it, expect, vi } from 'vitest'
import { calculateEloUpdates } from '../elo'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    commitment: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

describe('calculateEloUpdates', () => {
  it('returns empty map for fewer than 2 commitments', () => {
    expect(calculateEloUpdates([])).toEqual(new Map())
    expect(calculateEloUpdates([{ userId: 'a', brierScore: 0.1, eloRating: 1500 }])).toEqual(new Map())
  })

  it('winner gains ELO, loser loses ELO in equal-rated matchup', () => {
    const deltas = calculateEloUpdates([
      { userId: 'a', brierScore: 0.05, eloRating: 1500 }, // better (lower brier = win)
      { userId: 'b', brierScore: 0.40, eloRating: 1500 },
    ])
    expect(deltas.get('a')).toBeGreaterThan(0)
    expect(deltas.get('b')).toBeLessThan(0)
  })

  it('loser with higher rating loses more than lower-rated loser', () => {
    // a is rated 1600, b is 1400. a loses — should lose more than b would.
    const deltasHighLoses = calculateEloUpdates([
      { userId: 'a', brierScore: 0.40, eloRating: 1600 },
      { userId: 'b', brierScore: 0.05, eloRating: 1400 },
    ])
    const deltasLowLoses = calculateEloUpdates([
      { userId: 'a', brierScore: 0.05, eloRating: 1600 },
      { userId: 'b', brierScore: 0.40, eloRating: 1400 },
    ])
    // When high-rated player loses, they lose more ELO than when low-rated loses
    expect(deltasHighLoses.get('a')!).toBeLessThan(deltasLowLoses.get('b')!)
  })

  it('tie produces near-zero delta for equal-rated players', () => {
    const deltas = calculateEloUpdates([
      { userId: 'a', brierScore: 0.25, eloRating: 1500 },
      { userId: 'b', brierScore: 0.25, eloRating: 1500 },
    ])
    expect(deltas.get('a')).toBe(0)
    expect(deltas.get('b')).toBe(0)
  })

  it('sum of all deltas is approximately 0 (ELO conservation) in 3-way matchup', () => {
    const deltas = calculateEloUpdates([
      { userId: 'a', brierScore: 0.05, eloRating: 1500 },
      { userId: 'b', brierScore: 0.20, eloRating: 1520 },
      { userId: 'c', brierScore: 0.45, eloRating: 1480 },
    ])
    const total = [...deltas.values()].reduce((s, v) => s + v, 0)
    expect(Math.abs(total)).toBeLessThanOrEqual(2) // rounding can introduce ±1 per pair
  })

  it('fan-out: first place beats all others', () => {
    const deltas = calculateEloUpdates([
      { userId: 'winner', brierScore: 0.01, eloRating: 1500 },
      { userId: 'second', brierScore: 0.10, eloRating: 1500 },
      { userId: 'third',  brierScore: 0.30, eloRating: 1500 },
      { userId: 'fourth', brierScore: 0.49, eloRating: 1500 },
    ])
    expect(deltas.get('winner')).toBeGreaterThan(0)
    // winner should gain more than runner-up
    expect(deltas.get('winner')!).toBeGreaterThan(deltas.get('second')!)
    // last place should lose
    expect(deltas.get('fourth')).toBeLessThan(0)
  })
})

describe('replayEloHistory', () => {
  it('returns empty map when no resolved commitments exist', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { replayEloHistory } = await import('../elo')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([])

    const result = await replayEloHistory()
    expect(result.size).toBe(0)
  })

  it('returns empty map when all predictions have only 1 committer', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { replayEloHistory } = await import('../elo')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      { userId: 'solo', brierScore: 0.1, prediction: { id: 'p1', resolvedAt: new Date() } } as any,
    ])

    const result = await replayEloHistory()
    expect(result.size).toBe(0)
  })

  it('correctly replays two predictions in chronological order', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { replayEloHistory } = await import('../elo')

    // Prediction 1 (earlier): A wins over B
    // Prediction 2 (later): B wins over A — but B's ELO is now lower after pred 1
    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      { userId: 'a', brierScore: 0.05, prediction: { id: 'p1', resolvedAt: new Date('2026-01-01') } } as any,
      { userId: 'b', brierScore: 0.40, prediction: { id: 'p1', resolvedAt: new Date('2026-01-01') } } as any,
      { userId: 'b', brierScore: 0.05, prediction: { id: 'p2', resolvedAt: new Date('2026-02-01') } } as any,
      { userId: 'a', brierScore: 0.40, prediction: { id: 'p2', resolvedAt: new Date('2026-02-01') } } as any,
    ])

    const result = await replayEloHistory()
    // Both played 2 matches: 1 win + 1 loss each — should be close to 1500 but not identical
    expect(result.has('a')).toBe(true)
    expect(result.has('b')).toBe(true)
    // Both started at 1500; A won first, B won second — should roughly cancel
    expect(result.get('a')!).toBeGreaterThan(1400)
    expect(result.get('a')!).toBeLessThan(1600)
  })

  it('filters by tagSlug when provided — passes tag into prediction filter', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { replayEloHistory } = await import('../elo')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([])

    await replayEloHistory('crypto')

    const calls = vi.mocked(prisma.commitment.findMany).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const whereArg = calls[calls.length - 1][0]?.where as any
    // The tag filter is nested under prediction
    expect(JSON.stringify(whereArg)).toContain('crypto')
  })
})
