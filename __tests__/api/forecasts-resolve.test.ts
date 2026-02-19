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

vi.mock('@/lib/services/telegram', () => ({
  notifyForecastResolved: vi.fn(),
}))

vi.mock('@/lib/services/notification', () => ({
  createNotification: vi.fn(),
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

  it('uses params.id for prediction lookup (not URL parsing)', async () => {
    const { prisma } = await import('@/lib/prisma')

    mockGetServerSession.mockResolvedValue({
      user: { id: 'resolver1', email: 'resolver@example.com', role: 'RESOLVER' },
    })

    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(null)

    // URL path has a DIFFERENT id than params — params.id should win
    const request = new NextRequest('http://localhost/api/forecasts/wrong-id/resolve', {
      method: 'POST',
      body: JSON.stringify({ outcome: 'correct', resolutionNote: 'Test' }),
    })

    await resolvePrediction(request, { params: { id: 'correct-id' } })

    expect(prisma.prediction.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'correct-id' } })
    )
  })

  describe('commitment balance calculations', () => {
    const setupResolveWithCommitments = async (commitments: Array<{
      id: string
      userId: string
      cuCommitted: number
      binaryChoice: boolean | null
      optionId?: string | null
      rsSnapshot: number
      user: { id: string; cuAvailable: number; cuLocked: number; rs: number }
    }>) => {
      const { prisma } = await import('@/lib/prisma')

      mockGetServerSession.mockResolvedValue({
        user: { id: 'resolver1', email: 'resolver@example.com', role: 'RESOLVER' },
      })

      vi.mocked(prisma.prediction.findUnique).mockResolvedValue({
        id: 'pred-1',
        status: 'ACTIVE',
        outcomeType: 'BINARY',
        claimText: 'Test prediction',
        slug: 'test-prediction',
        options: [],
        commitments,
      } as never)

      const mockUserUpdate = vi.fn()
      const mockCommitmentUpdate = vi.fn()
      const mockCuTransactionCreate = vi.fn()

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          prediction: { update: vi.fn().mockResolvedValue({ id: 'pred-1', status: 'RESOLVED_CORRECT' }) },
          predictionOption: { update: vi.fn() },
          commitment: { update: mockCommitmentUpdate },
          user: { update: mockUserUpdate },
          cuTransaction: { create: mockCuTransactionCreate },
        }
        return fn(tx as never) as never
      })

      return { mockUserUpdate, mockCommitmentUpdate, mockCuTransactionCreate }
    }

    it('floors cuLocked at 0 when cuLocked < cuCommitted (out-of-sync guard)', async () => {
      // Scenario: user.cuLocked is 5, but cuCommitted is 10 (data drift)
      const { mockUserUpdate } = await setupResolveWithCommitments([{
        id: 'commit-1',
        userId: 'user1',
        cuCommitted: 10,
        binaryChoice: true,
        optionId: null,
        rsSnapshot: 100,
        user: { id: 'user1', cuAvailable: 50, cuLocked: 5, rs: 100 },
      }])

      const request = new NextRequest('http://localhost/api/forecasts/pred-1/resolve', {
        method: 'POST',
        body: JSON.stringify({ outcome: 'correct', resolutionNote: 'Test' }),
      })

      await resolvePrediction(request, { params: { id: 'pred-1' } })

      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cuLocked: 0, // Math.max(0, 5 - 10) = 0, not -5
          }),
        })
      )
    })

    it('calculates correct CU and RS for correct binary prediction', async () => {
      const { mockUserUpdate, mockCommitmentUpdate } = await setupResolveWithCommitments([{
        id: 'commit-1',
        userId: 'user1',
        cuCommitted: 20,
        binaryChoice: true,
        optionId: null,
        rsSnapshot: 100,
        user: { id: 'user1', cuAvailable: 80, cuLocked: 20, rs: 100 },
      }])

      const request = new NextRequest('http://localhost/api/forecasts/pred-1/resolve', {
        method: 'POST',
        body: JSON.stringify({ outcome: 'correct', resolutionNote: 'Test' }),
      })

      await resolvePrediction(request, { params: { id: 'pred-1' } })

      // cuReturned = floor(20 * 1.5) = 30, rsChange = 20 * 0.1 = 2
      expect(mockCommitmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { cuReturned: 30, rsChange: 2 },
        })
      )
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            cuAvailable: 110, // 80 + 30
            cuLocked: 0,      // max(0, 20 - 20)
            rs: 102,          // max(0, 100 + 2)
          },
        })
      )
    })

    it('calculates correct CU and RS for wrong binary prediction', async () => {
      const { mockUserUpdate, mockCommitmentUpdate } = await setupResolveWithCommitments([{
        id: 'commit-1',
        userId: 'user1',
        cuCommitted: 20,
        binaryChoice: true,
        optionId: null,
        rsSnapshot: 100,
        user: { id: 'user1', cuAvailable: 80, cuLocked: 20, rs: 100 },
      }])

      const request = new NextRequest('http://localhost/api/forecasts/pred-1/resolve', {
        method: 'POST',
        body: JSON.stringify({ outcome: 'wrong', resolutionNote: 'Test' }),
      })

      await resolvePrediction(request, { params: { id: 'pred-1' } })

      // cuReturned = 0, rsChange = -(20 * 0.05) = -1
      expect(mockCommitmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { cuReturned: 0, rsChange: -1 },
        })
      )
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            cuAvailable: 80, // 80 + 0
            cuLocked: 0,     // max(0, 20 - 20)
            rs: 99,          // max(0, 100 - 1)
          },
        })
      )
    })

    it('refunds CU fully on void resolution', async () => {
      const { mockUserUpdate, mockCommitmentUpdate } = await setupResolveWithCommitments([{
        id: 'commit-1',
        userId: 'user1',
        cuCommitted: 20,
        binaryChoice: true,
        optionId: null,
        rsSnapshot: 100,
        user: { id: 'user1', cuAvailable: 80, cuLocked: 20, rs: 100 },
      }])

      const request = new NextRequest('http://localhost/api/forecasts/pred-1/resolve', {
        method: 'POST',
        body: JSON.stringify({ outcome: 'void', resolutionNote: 'Voided' }),
      })

      await resolvePrediction(request, { params: { id: 'pred-1' } })

      expect(mockCommitmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { cuReturned: 20, rsChange: 0 },
        })
      )
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            cuAvailable: 100, // 80 + 20
            cuLocked: 0,
            rs: 100, // no change
          },
        })
      )
    })

    it('floors RS at 0 when loss exceeds current RS', async () => {
      const { mockUserUpdate } = await setupResolveWithCommitments([{
        id: 'commit-1',
        userId: 'user1',
        cuCommitted: 50,
        binaryChoice: true,
        optionId: null,
        rsSnapshot: 2,
        user: { id: 'user1', cuAvailable: 50, cuLocked: 50, rs: 2 },
      }])

      const request = new NextRequest('http://localhost/api/forecasts/pred-1/resolve', {
        method: 'POST',
        body: JSON.stringify({ outcome: 'wrong', resolutionNote: 'Test' }),
      })

      await resolvePrediction(request, { params: { id: 'pred-1' } })

      // rsChange = -(50 * 0.05) = -2.5, but rs = max(0, 2 + (-2.5)) = 0
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rs: 0,
          }),
        })
      )
    })
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
