import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      deleteMany: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}))
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}))

describe('upsertPushSubscription', () => {
  beforeEach(() => vi.clearAllMocks())

  it('removes any other user subscription on same endpoint then upserts', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { upsertPushSubscription } = await import('@/lib/services/push')

    await upsertPushSubscription('user-1', 'https://endpoint', 'p256dh', 'auth', 'Chrome/120')

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://endpoint', userId: { not: 'user-1' } },
    })
    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
      where: { endpoint: 'https://endpoint' },
      create: { userId: 'user-1', endpoint: 'https://endpoint', p256dh: 'p256dh', auth: 'auth', userAgent: 'Chrome/120' },
      update: { p256dh: 'p256dh', auth: 'auth', userAgent: 'Chrome/120' },
    })
  })

  it('works without userAgent', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { upsertPushSubscription } = await import('@/lib/services/push')

    await upsertPushSubscription('user-2', 'https://ep2', 'k', 'a')

    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ userAgent: undefined }) }),
    )
  })
})

describe('deletePushSubscription', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes by endpoint and userId', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { deletePushSubscription } = await import('@/lib/services/push')

    await deletePushSubscription('user-1', 'https://endpoint')

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: 'https://endpoint', userId: 'user-1' },
    })
  })
})
