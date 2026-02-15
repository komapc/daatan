import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/commitments/stats/route'

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('next-auth/next', () => ({ getServerSession: mockGetServerSession }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    commitment: {
      findMany: vi.fn(),
    },
  },
}))

describe('GET /api/commitments/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/commitments/stats')
    const response = await GET(request, { params: {} } as any)

    expect(response.status).toBe(401)
  })

  it('returns correct stats for a user with mixed commitments', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com', role: 'USER' },
    })

    const { prisma } = await import('@/lib/prisma')

    const mockCommitments = [
      // Correct prediction (returned more than committed)
      { cuCommitted: 10, cuReturned: 15, rsChange: 1.0, prediction: { status: 'RESOLVED_CORRECT' } },
      // Wrong prediction (returned 0)
      { cuCommitted: 20, cuReturned: 0, rsChange: -1.0, prediction: { status: 'RESOLVED_WRONG' } },
      // Pending
      { cuCommitted: 5, cuReturned: null, rsChange: null, prediction: { status: 'ACTIVE' } },
      // Another correct
      { cuCommitted: 15, cuReturned: 22, rsChange: 1.5, prediction: { status: 'RESOLVED_CORRECT' } },
    ]

    vi.mocked(prisma.commitment.findMany).mockResolvedValue(mockCommitments as any)

    const request = new NextRequest('http://localhost/api/commitments/stats')
    const response = await GET(request, { params: {} } as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.total).toBe(4)
    expect(data.resolved).toBe(3)
    expect(data.correct).toBe(2)
    expect(data.wrong).toBe(1)
    expect(data.pending).toBe(1)
    expect(data.accuracy).toBe(67) // 2/3 = 66.7 -> Math.round = 67
    expect(data.totalCuCommitted).toBe(50) // 10+20+5+15
    expect(data.totalCuReturned).toBe(37) // 15+0+0+22
    expect(data.netCu).toBe(-13) // 37-50
    expect(data.totalRsChange).toBe(1.5) // 1.0 + (-1.0) + 0 + 1.5
  })

  it('returns null accuracy when no commitments are resolved', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com', role: 'USER' },
    })

    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      { cuCommitted: 10, cuReturned: null, rsChange: null, prediction: { status: 'ACTIVE' } },
    ] as any)

    const request = new NextRequest('http://localhost/api/commitments/stats')
    const response = await GET(request, { params: {} } as any)
    const data = await response.json()

    expect(data.accuracy).toBeNull()
    expect(data.total).toBe(1)
    expect(data.pending).toBe(1)
  })

  it('returns zeros when user has no commitments', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com', role: 'USER' },
    })

    const { prisma } = await import('@/lib/prisma')

    vi.mocked(prisma.commitment.findMany).mockResolvedValue([])

    const request = new NextRequest('http://localhost/api/commitments/stats')
    const response = await GET(request, { params: {} } as any)
    const data = await response.json()

    expect(data.total).toBe(0)
    expect(data.accuracy).toBeNull()
    expect(data.netCu).toBe(0)
  })
})
