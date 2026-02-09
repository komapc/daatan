import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as resolvePrediction } from '@/app/api/predictions/[id]/resolve/route'

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    prediction: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    commitment: {
      update: vi.fn(),
    },
    cuTransaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        prediction: {
          update: vi.fn().mockResolvedValue({
            id: 'pred-1',
            status: 'RESOLVED_CORRECT',
            resolvedAt: new Date(),
            resolvedById: 'resolver1',
          }),
        },
        commitment: { update: vi.fn() },
        user: { update: vi.fn() },
        cuTransaction: { create: vi.fn() },
      })
    ),
  },
}))

describe('POST /api/predictions/[id]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { getServerSession } = await import('next-auth/next')

    vi.mocked(getServerSession).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/predictions/pred-1/resolve', {
      method: 'POST',
      body: JSON.stringify({
        outcome: 'correct',
        resolutionNote: 'Test',
      }),
    })

    const response = await resolvePrediction(request, { params: { id: 'pred-1' } })

    expect(response.status).toBe(401)
  })

  it('returns 403 when user is not RESOLVER or ADMIN', async () => {
    const { getServerSession } = await import('next-auth/next')
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user1', email: 'user@example.com' },
    } as never)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user1',
      role: 'USER',
    } as never)

    const request = new NextRequest('http://localhost/api/predictions/pred-1/resolve', {
      method: 'POST',
      body: JSON.stringify({
        outcome: 'correct',
        resolutionNote: 'Test',
      }),
    })

    const response = await resolvePrediction(request, { params: { id: 'pred-1' } })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('resolvers')
  })

  it('allows RESOLVER to resolve prediction', async () => {
    const { getServerSession } = await import('next-auth/next')
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'resolver1', email: 'resolver@example.com' },
    } as never)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'resolver1',
      role: 'RESOLVER',
    } as never)

    vi.mocked(prisma.prediction.findUnique).mockResolvedValue({
      id: 'pred-1',
      status: 'ACTIVE',
      commitments: [],
    } as never)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        prediction: { update: vi.fn().mockResolvedValue({ id: 'pred-1', status: 'RESOLVED_CORRECT' }) },
        commitment: { update: vi.fn() },
        user: { update: vi.fn() },
        cuTransaction: { create: vi.fn() },
      }
      return fn(tx as never) as never
    })

    const request = new NextRequest('http://localhost/api/predictions/pred-1/resolve', {
      method: 'POST',
      body: JSON.stringify({
        outcome: 'correct',
        resolutionNote: 'Resolved as correct',
      }),
    })

    const response = await resolvePrediction(request, { params: { id: 'pred-1' } })

    expect(response.status).toBe(200)
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'resolver1' },
      select: { role: true },
    })
    expect(prisma.prediction.findUnique).toHaveBeenCalledWith({
      where: { id: 'pred-1' },
      include: expect.objectContaining({ commitments: expect.any(Object) }),
    })
  })

  it('allows ADMIN to resolve prediction', async () => {
    const { getServerSession } = await import('next-auth/next')
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'admin1', email: 'admin@example.com' },
    } as never)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'admin1',
      role: 'ADMIN',
    } as never)

    vi.mocked(prisma.prediction.findUnique).mockResolvedValue({
      id: 'pred-1',
      status: 'ACTIVE',
      commitments: [],
    } as never)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        prediction: { update: vi.fn().mockResolvedValue({ id: 'pred-1', status: 'RESOLVED_CORRECT' }) },
        commitment: { update: vi.fn() },
        user: { update: vi.fn() },
        cuTransaction: { create: vi.fn() },
      }
      return fn(tx as never) as never
    })

    const request = new NextRequest('http://localhost/api/predictions/pred-1/resolve', {
      method: 'POST',
      body: JSON.stringify({
        outcome: 'wrong',
        resolutionNote: 'Resolved as wrong',
      }),
    })

    const response = await resolvePrediction(request, { params: { id: 'pred-1' } })

    expect(response.status).toBe(200)
  })

  it('returns 404 when prediction not found', async () => {
    const { getServerSession } = await import('next-auth/next')
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'resolver1', email: 'resolver@example.com' },
    } as never)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'resolver1',
      role: 'RESOLVER',
    } as never)

    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/predictions/nonexistent/resolve', {
      method: 'POST',
      body: JSON.stringify({
        outcome: 'correct',
      }),
    })

    const response = await resolvePrediction(request, { params: { id: 'nonexistent' } })

    expect(response.status).toBe(404)
  })

  it('returns 400 when prediction is already resolved', async () => {
    const { getServerSession } = await import('next-auth/next')
    const { prisma } = await import('@/lib/prisma')

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'resolver1', email: 'resolver@example.com' },
    } as never)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'resolver1',
      role: 'RESOLVER',
    } as never)

    vi.mocked(prisma.prediction.findUnique).mockResolvedValue({
      id: 'pred-1',
      status: 'RESOLVED_CORRECT',
      commitments: [],
    } as never)

    const request = new NextRequest('http://localhost/api/predictions/pred-1/resolve', {
      method: 'POST',
      body: JSON.stringify({
        outcome: 'correct',
      }),
    })

    const response = await resolvePrediction(request, { params: { id: 'pred-1' } })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('cannot be resolved')
  })
})
