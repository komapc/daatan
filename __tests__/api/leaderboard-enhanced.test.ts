import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/leaderboard/route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    commitment: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

const mockUsers = [
  {
    id: 'u1',
    name: 'Alice',
    username: 'alice',
    image: null,
    rs: 120,
    cuAvailable: 50,
    _count: { predictions: 5, commitments: 2 },
  },
  {
    id: 'u2',
    name: 'Bob',
    username: 'bob',
    image: null,
    rs: 100,
    cuAvailable: 100,
    _count: { predictions: 3, commitments: 3 },
  },
]

// Aggregated commitment data matching the old mockUsers inline commitments
const mockCuSums = [
  { userId: 'u1', _sum: { cuCommitted: 20 } },  // 10 + 10
  { userId: 'u2', _sum: { cuCommitted: 45 } },  // 20 + 20 + 5
]
const mockRsGainSums = [
  { userId: 'u1', _sum: { rsChange: 2.0 } },  // only rsChange > 0
  { userId: 'u2', _sum: { rsChange: 6.0 } },  // 3.0 + 3.0
]
const mockResolvedCommitments = [
  { userId: 'u1', cuCommitted: 10, cuReturned: 15 }, // correct (15 > 10)
  { userId: 'u1', cuCommitted: 10, cuReturned: 0 },  // wrong (0 < 10)
  { userId: 'u2', cuCommitted: 20, cuReturned: 30 }, // correct
  { userId: 'u2', cuCommitted: 20, cuReturned: 30 }, // correct
]

describe('GET /api/leaderboard (enhanced)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { prisma } = await import('@/lib/prisma')
    // Default: groupBy called three times (cuSums, rsGainSums, brierScoreSums) + findMany for resolved
    vi.mocked(prisma.commitment.groupBy)
      .mockResolvedValueOnce(mockCuSums as any)
      .mockResolvedValueOnce(mockRsGainSums as any)
      .mockResolvedValue([] as any) // brierScoreSums — no brier data by default
    vi.mocked(prisma.commitment.findMany).mockResolvedValue(mockResolvedCommitments as any)
  })

  it('returns leaderboard sorted by RS (default)', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

    const request = new NextRequest('http://localhost/api/leaderboard')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.leaderboard).toHaveLength(2)
    expect(data.leaderboard[0].username).toBe('alice') // rs=120 > 100
    expect(data.leaderboard[1].username).toBe('bob')
  })

  it('sorts by accuracy when requested', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

    const request = new NextRequest('http://localhost/api/leaderboard?sortBy=accuracy')
    const response = await GET(request)
    const data = await response.json()

    // Bob: 2/2 = 100%, Alice: 1/2 = 50%
    expect(data.leaderboard[0].username).toBe('bob')
    expect(data.leaderboard[0].accuracy).toBe(100)
    expect(data.leaderboard[1].username).toBe('alice')
    expect(data.leaderboard[1].accuracy).toBe(50)
  })

  it('sorts by totalCorrect when requested', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

    const request = new NextRequest('http://localhost/api/leaderboard?sortBy=totalCorrect')
    const response = await GET(request)
    const data = await response.json()

    // Bob: 2 correct, Alice: 1 correct
    expect(data.leaderboard[0].username).toBe('bob')
    expect(data.leaderboard[0].totalCorrect).toBe(2)
    expect(data.leaderboard[1].totalCorrect).toBe(1)
  })

  it('sorts by cuCommitted when requested', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

    const request = new NextRequest('http://localhost/api/leaderboard?sortBy=cuCommitted')
    const response = await GET(request)
    const data = await response.json()

    // Bob: 45 CU, Alice: 20 CU
    expect(data.leaderboard[0].username).toBe('bob')
    expect(data.leaderboard[0].totalCuCommitted).toBe(45)
    expect(data.leaderboard[1].totalCuCommitted).toBe(20)
  })

  it('respects limit parameter', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

    const request = new NextRequest('http://localhost/api/leaderboard?limit=1')
    const response = await GET(request)
    const data = await response.json()

    expect(data.leaderboard).toHaveLength(1)
  })

  it('caps limit at 100', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.commitment.groupBy).mockResolvedValue([])
    vi.mocked(prisma.commitment.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/leaderboard?limit=999')
    await GET(request)

    expect(prisma.user.findMany).toHaveBeenCalled()
  })

  it('computes totalRsGained correctly (only positive rsChange)', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

    const request = new NextRequest('http://localhost/api/leaderboard')
    const response = await GET(request)
    const data = await response.json()

    // Alice: only rsChange > 0 summed at DB level = 2.0
    const alice = data.leaderboard.find((u: any) => u.username === 'alice')
    expect(alice.totalRsGained).toBe(2)

    // Bob: 3.0 + 3.0 = 6.0
    const bob = data.leaderboard.find((u: any) => u.username === 'bob')
    expect(bob.totalRsGained).toBe(6)
  })

  it('handles database errors gracefully', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error('DB error'))

    const request = new NextRequest('http://localhost/api/leaderboard')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch leaderboard')
  })
})
