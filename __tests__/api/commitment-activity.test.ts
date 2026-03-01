import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/commitments/activity/route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    commitment: {
      findMany: vi.fn(),
    },
  },
}))

describe('GET /api/commitments/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns recent commitments as activity feed', async () => {
    const { prisma } = await import('@/lib/prisma')

    const mockActivity = [
      {
        id: 'c1',
        cuCommitted: 10,
        binaryChoice: true,
        createdAt: '2026-02-15T00:00:00Z',
        user: { id: 'u1', name: 'Alice', username: 'alice', image: null, rs: 110 },
        prediction: { id: 'p1', slug: 'test', claimText: 'Test prediction', status: 'ACTIVE', outcomeType: 'BINARY' },
        option: null,
      },
    ]

    vi.mocked(prisma.commitment.findMany).mockResolvedValue(mockActivity as any)

    const request = new NextRequest('http://localhost/api/commitments/activity?limit=10')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.activity).toHaveLength(1)
    expect(data.activity[0].user.name).toBe('Alice')
    expect(data.activity[0].cuCommitted).toBe(10)
  })

  it('caps limit at 50', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/commitments/activity?limit=200')
    await GET(request)

    expect(prisma.commitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    )
  })

  it('defaults limit to 20', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/commitments/activity')
    await GET(request)

    expect(prisma.commitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
      })
    )
  })

  it('filters out commitments on private forecasts', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/commitments/activity')
    await GET(request)

    const call = vi.mocked(prisma.commitment.findMany).mock.calls[0][0] as any
    expect(call.where.prediction).toEqual({ isPublic: true })
  })

  it('filters out commitments from private users', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/commitments/activity')
    await GET(request)

    const call = vi.mocked(prisma.commitment.findMany).mock.calls[0][0] as any
    expect(call.where.user).toEqual({ isPublic: true })
  })

  it('handles database errors gracefully', async () => {
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.commitment.findMany).mockRejectedValue(new Error('DB error'))

    const request = new NextRequest('http://localhost/api/commitments/activity')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch activity feed')
  })
})
