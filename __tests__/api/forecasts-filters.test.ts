import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/forecasts/route'

const { mockGetServerSession, mockFindMany, mockCount, mockUpdateMany, mockTransition } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockFindMany: vi.fn().mockResolvedValue([]),
  mockCount: vi.fn().mockResolvedValue(0),
  mockUpdateMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockTransition: vi.fn().mockResolvedValue(0),
}))

vi.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    prediction: {
      findMany: mockFindMany,
      count: mockCount,
      updateMany: mockUpdateMany,
    },
  },
}))

vi.mock('@/lib/services/prediction-lifecycle', () => ({
  transitionExpiredPredictions: mockTransition,
}))

describe('GET /api/forecasts - Status Filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
    mockGetServerSession.mockResolvedValue(null)
    mockTransition.mockResolvedValue(0)
  })

  it('calls transitionExpiredPredictions before querying', async () => {
    const request = new NextRequest('http://localhost/api/forecasts?status=ACTIVE')
    await GET(request)

    expect(mockTransition).toHaveBeenCalledTimes(1)
    expect(mockFindMany).toHaveBeenCalled()
  })

  it('filters ACTIVE predictions correctly', async () => {
    const request = new NextRequest('http://localhost/api/forecasts?status=ACTIVE')
    await GET(request)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
        }),
      })
    )
  })

  it('filters PENDING (Awaiting Resolution) predictions correctly', async () => {
    const request = new NextRequest('http://localhost/api/forecasts?status=PENDING')
    await GET(request)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PENDING',
        }),
      })
    )
  })

  it('filters Closing Soon as ACTIVE with resolveByDatetime range', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-18T12:00:00Z'))

    const request = new NextRequest('http://localhost/api/forecasts?status=ACTIVE&closingSoon=true')
    await GET(request)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          resolveByDatetime: {
            lte: expect.any(Date),
            gte: expect.any(Date),
          },
        }),
      })
    )

    // Verify the date range is within 7 days
    const whereArg = mockFindMany.mock.calls[0][0].where
    const lte = whereArg.resolveByDatetime.lte as Date
    const gte = whereArg.resolveByDatetime.gte as Date
    expect(lte.getTime() - gte.getTime()).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000)

    vi.useRealTimers()
  })

  it('filters resolved predictions including VOID and UNRESOLVABLE', async () => {
    const request = new NextRequest('http://localhost/api/forecasts?resolvedOnly=true')
    await GET(request)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['RESOLVED_CORRECT', 'RESOLVED_WRONG', 'VOID', 'UNRESOLVABLE'] },
        }),
      })
    )
  })

  it('returns all non-DRAFT/PENDING_APPROVAL predictions when no filter specified', async () => {
    const request = new NextRequest('http://localhost/api/forecasts')
    await GET(request)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: ['DRAFT', 'PENDING_APPROVAL'] },
        }),
      })
    )
  })

  it('orders Closing Soon by resolveByDatetime ascending', async () => {
    const request = new NextRequest('http://localhost/api/forecasts?status=ACTIVE&closingSoon=true')
    await GET(request)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { resolveByDatetime: 'asc' },
      })
    )
  })

  it('orders non-closing-soon by createdAt descending', async () => {
    const request = new NextRequest('http://localhost/api/forecasts?status=PENDING')
    await GET(request)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    )
  })
})
