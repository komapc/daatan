import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as resolvePrediction } from '@/app/api/forecasts/[id]/resolve/route'

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}))

vi.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
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
    predictionOption: {
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
        predictionOption: { update: vi.fn() },
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
    mockGetServerSession.mockResolvedValue(null)

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
    // withAuth checks role from session — USER role is not in allowed roles
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user1', email: 'user@example.com', role: 'USER' },
    })

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
    expect(data.error).toContain('Forbidden')
  })

  it('allows RESOLVER to resolve prediction', async () => {
    const { prisma } = await import('@/lib/prisma')

    mockGetServerSession.mockResolvedValue({
      user: { id: 'resolver1', email: 'resolver@example.com', role: 'RESOLVER' },
    })

    vi.mocked(prisma.prediction.findUnique).mockResolvedValue({
      id: 'pred-1',
      status: 'ACTIVE',
      outcomeType: 'BINARY',
      options: [],
      commitments: [],
    } as never)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        prediction: { update: vi.fn().mockResolvedValue({ id: 'pred-1', status: 'RESOLVED_CORRECT' }) },
        predictionOption: { update: vi.fn() },
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
        resolutionNote: 'Resolution note',
      }),
    })

    const response = await resolvePrediction(request, { params: { id: 'pred-1' } })

    expect(response.status).toBe(200)
  })

  it('allows ADMIN to resolve prediction', async () => {
    const { prisma } = await import('@/lib/prisma')

    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin1', email: 'admin@example.com', role: 'ADMIN' },
    })

    vi.mocked(prisma.prediction.findUnique).mockResolvedValue({
      id: 'pred-1',
      status: 'ACTIVE',
      outcomeType: 'BINARY',
      options: [],
      commitments: [],
    } as never)

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        prediction: { update: vi.fn().mockResolvedValue({ id: 'pred-1', status: 'RESOLVED_CORRECT' }) },
        predictionOption: { update: vi.fn() },
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
        resolutionNote: 'Admin resolution',
      }),
    })

    const response = await resolvePrediction(request, { params: { id: 'pred-1' } })

    expect(response.status).toBe(200)
  })

  it('returns 404 when prediction not found', async () => {
    const { prisma } = await import('@/lib/prisma')

    mockGetServerSession.mockResolvedValue({
      user: { id: 'resolver1', email: 'resolver@example.com', role: 'RESOLVER' },
    })

    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/predictions/nonexistent/resolve', {
      method: 'POST',
      body: JSON.stringify({
        outcome: 'correct',
        resolutionNote: 'Test',
      }),
    })

    const response = await resolvePrediction(request, { params: { id: 'nonexistent' } })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('returns 400 when prediction is already resolved', async () => {
    const { prisma } = await import('@/lib/prisma')

    mockGetServerSession.mockResolvedValue({
      user: { id: 'resolver1', email: 'resolver@example.com', role: 'RESOLVER' },
    })

    vi.mocked(prisma.prediction.findUnique).mockResolvedValue({
      id: 'pred-1',
      status: 'RESOLVED_CORRECT',
      outcomeType: 'BINARY',
      options: [],
      commitments: [],
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

    expect(response.status).toBe(400)
    expect(data.error).toContain('cannot be resolved')
  })
})
