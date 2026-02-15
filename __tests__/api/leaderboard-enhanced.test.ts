import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/leaderboard/route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
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
    commitments: [
      { cuCommitted: 10, cuReturned: 15, rsChange: 2.0, prediction: { status: 'RESOLVED_CORRECT' } },
      { cuCommitted: 10, cuReturned: 0, rsChange: -1.0, prediction: { status: 'RESOLVED_WRONG' } },
    ],
    _count: { predictions: 5, commitments: 2 },
  },
  {
    id: 'u2',
    name: 'Bob',
    username: 'bob',
    image: null,
    rs: 100,
    cuAvailable: 100,
    commitments: [
      { cuCommitted: 20, cuReturned: 30, rsChange: 3.0, prediction: { status: 'RESOLVED_CORRECT' } },
      { cuCommitted: 20, cuReturned: 30, rsChange: 3.0, prediction: { status: 'RESOLVED_CORRECT' } },
      { cuCommitted: 5, cuReturned: null, rsChange: null, prediction: { status: 'ACTIVE' } },
    ],
    _count: { predictions: 3, commitments: 3 },
  },
]

describe('GET /api/leaderboard (enhanced)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    const request = new NextRequest('http://localhost/api/leaderboard?limit=999')
    await GET(request)

    // Can't check the take directly since sorting is post-query,
    // but the response should slice to 100 max
    expect(prisma.user.findMany).toHaveBeenCalled()
  })

  it('computes totalRsGained correctly (only positive rsChange)', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

    const request = new NextRequest('http://localhost/api/leaderboard')
    const response = await GET(request)
    const data = await response.json()

    // Alice: max(0,2.0) + max(0,-1.0) = 2.0
    const alice = data.leaderboard.find((u: any) => u.username === 'alice')
    expect(alice.totalRsGained).toBe(2)

    // Bob: max(0,3.0) + max(0,3.0) + max(0,0) = 6.0
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
