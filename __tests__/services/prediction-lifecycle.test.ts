import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    prediction: {
      updateMany: vi.fn(),
    },
  },
}))

describe('Prediction Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-18T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('transitionExpiredPredictions', () => {
    it('transitions ACTIVE predictions past resolveByDatetime to PENDING', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { transitionExpiredPredictions } = await import('@/lib/services/prediction-lifecycle')

      vi.mocked(prisma.prediction.updateMany).mockResolvedValue({ count: 3 })

      const result = await transitionExpiredPredictions()

      expect(result).toBe(3)
      expect(prisma.prediction.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          resolveByDatetime: { lt: expect.any(Date) },
        },
        data: {
          status: 'PENDING',
        },
      })
    })

    it('returns 0 when no predictions need transitioning', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { transitionExpiredPredictions } = await import('@/lib/services/prediction-lifecycle')

      vi.mocked(prisma.prediction.updateMany).mockResolvedValue({ count: 0 })

      const result = await transitionExpiredPredictions()

      expect(result).toBe(0)
    })
  })

  describe('transitionIfExpired', () => {
    it('transitions a single expired prediction to PENDING', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { transitionIfExpired } = await import('@/lib/services/prediction-lifecycle')

      vi.mocked(prisma.prediction.updateMany).mockResolvedValue({ count: 1 })

      await transitionIfExpired('pred-123')

      expect(prisma.prediction.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'pred-123',
          status: 'ACTIVE',
          resolveByDatetime: { lt: expect.any(Date) },
        },
        data: {
          status: 'PENDING',
        },
      })
    })

    it('does nothing for non-expired or non-ACTIVE predictions', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { transitionIfExpired } = await import('@/lib/services/prediction-lifecycle')

      vi.mocked(prisma.prediction.updateMany).mockResolvedValue({ count: 0 })

      await transitionIfExpired('pred-456')

      expect(prisma.prediction.updateMany).toHaveBeenCalledTimes(1)
    })
  })
})
