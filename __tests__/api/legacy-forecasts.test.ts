import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/legacy-forecasts/[id]/route'
import { POST as resolveForcast } from '@/app/api/legacy-forecasts/[id]/resolve/route'

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}))

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession,
}))

// Use CUID-like IDs to pass Zod validation
const OPT_YES_ID = 'clopt00000000yes00000001'
const OPT_NO_ID = 'clopt00000000noo00000002'

const mockForecast = {
  id: 'forecast-1',
  title: 'Test Forecast',
  status: 'ACTIVE',
  creatorId: 'user1',
  creator: {
    id: 'user1',
    name: 'Test User',
    username: 'testuser',
    image: null,
  },
  options: [
    { id: OPT_YES_ID, text: 'Yes', displayOrder: 0, isCorrect: null, _count: { votes: 2 } },
    { id: OPT_NO_ID, text: 'No', displayOrder: 1, isCorrect: null, _count: { votes: 1 } },
  ],
  votes: [
    {
      id: 'vote-1',
      userId: 'user2',
      optionId: OPT_YES_ID,
      confidence: 80,
      brierScore: null,
      user: { id: 'user2', name: 'Voter', username: 'voter', image: null },
      option: { id: OPT_YES_ID, text: 'Yes' },
    },
  ],
  _count: { votes: 3 },
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    forecast: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    forecastOption: {
      updateMany: vi.fn(),
    },
    vote: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe('Legacy Forecasts API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/legacy-forecasts/[id]', () => {
    it('returns forecast without deprecated brierScore on creator', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.forecast.findUnique).mockResolvedValue(mockForecast as never)

      const request = new NextRequest('http://localhost/api/legacy-forecasts/forecast-1')
      const response = await GET(request, { params: { id: 'forecast-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.creator).toBeDefined()
      expect(data.creator).not.toHaveProperty('brierScore')
      expect(data.creator).toHaveProperty('id')
      expect(data.creator).toHaveProperty('name')
      expect(data.creator).toHaveProperty('username')
      expect(data.creator).toHaveProperty('image')
    })

    it('returns 404 when forecast not found', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.forecast.findUnique).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/legacy-forecasts/nonexistent')
      const response = await GET(request, { params: { id: 'nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })

    it('includes votes and options in response', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.forecast.findUnique).mockResolvedValue(mockForecast as never)

      const request = new NextRequest('http://localhost/api/legacy-forecasts/forecast-1')
      const response = await GET(request, { params: { id: 'forecast-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.options).toHaveLength(2)
      expect(data.votes).toHaveLength(1)
      expect(data._count.votes).toBe(3)
    })
  })

  describe('POST /api/legacy-forecasts/[id]/resolve', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/legacy-forecasts/forecast-1/resolve', {
        method: 'POST',
        body: JSON.stringify({
          correctOptionId: OPT_YES_ID,
          resolutionNote: 'Test resolution',
        }),
      })

      const response = await resolveForcast(request, { params: { id: 'forecast-1' } })
      expect(response.status).toBe(401)
    })

    it('returns 403 for non-admin/resolver users', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user1', email: 'user@test.com', role: 'USER' },
      })

      const request = new NextRequest('http://localhost/api/legacy-forecasts/forecast-1/resolve', {
        method: 'POST',
        body: JSON.stringify({
          correctOptionId: OPT_YES_ID,
          resolutionNote: 'Test resolution',
        }),
      })

      const response = await resolveForcast(request, { params: { id: 'forecast-1' } })
      expect(response.status).toBe(403)
    })

    it('returns 404 when forecast not found', async () => {
      const { prisma } = await import('@/lib/prisma')
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', email: 'admin@test.com', role: 'ADMIN' },
      })
      vi.mocked(prisma.forecast.findUnique).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/legacy-forecasts/nonexistent/resolve', {
        method: 'POST',
        body: JSON.stringify({
          correctOptionId: OPT_YES_ID,
          resolutionNote: 'Test',
        }),
      })

      const response = await resolveForcast(request, { params: { id: 'nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })

    it('returns 400 for already resolved forecasts', async () => {
      const { prisma } = await import('@/lib/prisma')
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', email: 'admin@test.com', role: 'ADMIN' },
      })
      vi.mocked(prisma.forecast.findUnique).mockResolvedValue({
        id: 'forecast-1',
        status: 'RESOLVED',
        options: [{ id: OPT_YES_ID }],
        votes: [],
      } as never)

      const request = new NextRequest('http://localhost/api/legacy-forecasts/forecast-1/resolve', {
        method: 'POST',
        body: JSON.stringify({
          correctOptionId: OPT_YES_ID,
          resolutionNote: 'Test',
        }),
      })

      const response = await resolveForcast(request, { params: { id: 'forecast-1' } })
      expect(response.status).toBe(400)
    })

    it('calculates Vote.brierScore but does NOT update User.brierScore', async () => {
      const { prisma } = await import('@/lib/prisma')
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', email: 'admin@test.com', role: 'ADMIN' },
      })

      const forecastWithVotes = {
        id: 'forecast-1',
        status: 'ACTIVE',
        options: [
          { id: OPT_YES_ID, text: 'Yes' },
          { id: OPT_NO_ID, text: 'No' },
        ],
        votes: [
          { id: 'vote-1', userId: 'user2', optionId: OPT_YES_ID, confidence: 80 },
          { id: 'vote-2', userId: 'user3', optionId: OPT_NO_ID, confidence: 60 },
        ],
      }

      // First call: initial findUnique for the forecast
      vi.mocked(prisma.forecast.findUnique)
        .mockResolvedValueOnce(forecastWithVotes as never)
        // Second call: fetching the updated forecast after resolution
        .mockResolvedValueOnce({
          ...forecastWithVotes,
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedById: 'admin1',
        } as never)

      const mockVoteUpdate = vi.fn().mockResolvedValue({})
      const mockUserUpdate = vi.fn().mockResolvedValue({})

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          forecast: { update: vi.fn().mockResolvedValue({}) },
          forecastOption: { updateMany: vi.fn().mockResolvedValue({}) },
          vote: { update: mockVoteUpdate },
          user: { update: mockUserUpdate },
        }
        return (fn as (tx: unknown) => Promise<unknown>)(tx)
      })

      const request = new NextRequest('http://localhost/api/legacy-forecasts/forecast-1/resolve', {
        method: 'POST',
        body: JSON.stringify({
          correctOptionId: OPT_YES_ID,
          resolutionNote: 'Yes was correct',
        }),
      })

      const response = await resolveForcast(request, { params: { id: 'forecast-1' } })
      expect(response.status).toBe(200)

      // Vote.brierScore should be calculated and updated for each vote
      expect(mockVoteUpdate).toHaveBeenCalledTimes(2)

      // vote-1 picked opt-yes (correct): brierScore = (0.8 - 1)^2 = 0.04
      expect(mockVoteUpdate).toHaveBeenCalledWith({
        where: { id: 'vote-1' },
        data: { brierScore: expect.closeTo(0.04, 5) },
      })

      // vote-2 picked opt-no (wrong): brierScore = (0.6 - 0)^2 = 0.36
      expect(mockVoteUpdate).toHaveBeenCalledWith({
        where: { id: 'vote-2' },
        data: { brierScore: expect.closeTo(0.36, 5) },
      })

      // User.brierScore should NOT be updated (deprecated field removed)
      expect(mockUserUpdate).not.toHaveBeenCalled()
    })

    it('does not include brierScore in user select on response', async () => {
      const { prisma } = await import('@/lib/prisma')
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin1', email: 'admin@test.com', role: 'ADMIN' },
      })

      const forecastWithVotes = {
        id: 'forecast-1',
        status: 'ACTIVE',
        options: [{ id: OPT_YES_ID, text: 'Yes' }],
        votes: [],
      }

      vi.mocked(prisma.forecast.findUnique)
        .mockResolvedValueOnce(forecastWithVotes as never)
        .mockResolvedValueOnce({
          ...forecastWithVotes,
          status: 'RESOLVED',
          votes: [{
            id: 'vote-1',
            user: { id: 'user2', name: 'Voter', username: 'voter', image: null },
            option: { id: OPT_YES_ID, text: 'Yes', isCorrect: true },
          }],
          creator: { id: 'user1', name: 'Creator', username: 'creator', image: null },
        } as never)

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          forecast: { update: vi.fn().mockResolvedValue({}) },
          forecastOption: { updateMany: vi.fn().mockResolvedValue({}) },
          vote: { update: vi.fn().mockResolvedValue({}) },
        }
        return (fn as (tx: unknown) => Promise<unknown>)(tx)
      })

      const request = new NextRequest('http://localhost/api/legacy-forecasts/forecast-1/resolve', {
        method: 'POST',
        body: JSON.stringify({
          correctOptionId: OPT_YES_ID,
          resolutionNote: 'Yes was correct',
        }),
      })

      const response = await resolveForcast(request, { params: { id: 'forecast-1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      // Verify the response user objects don't contain brierScore
      if (data.votes?.length > 0) {
        expect(data.votes[0].user).not.toHaveProperty('brierScore')
      }
      if (data.creator) {
        expect(data.creator).not.toHaveProperty('brierScore')
      }
    })
  })
})
