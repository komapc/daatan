import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificationPreference: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

// Mock the logger to suppress output in tests
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createNotification', () => {
    it('creates a notification when no preference exists', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { createNotification } = await import('@/lib/services/notification')

      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.notification.create).mockResolvedValue({
        id: 'n1',
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        title: 'New comment',
        message: 'Someone commented on your forecast',
      } as any)

      const result = await createNotification({
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        title: 'New comment',
        message: 'Someone commented on your forecast',
        actorId: 'user2',
      })

      expect(result).not.toBeNull()
      expect(result?.id).toBe('n1')
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user1',
          type: 'COMMENT_ON_FORECAST',
          title: 'New comment',
        }),
      })
    })

    it('skips notification when user disabled in-app for that type', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { createNotification } = await import('@/lib/services/notification')

      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
        id: 'pref1',
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        inApp: false,
        email: false,
        browserPush: false,
        telegram: false,
      } as any)

      const result = await createNotification({
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        title: 'New comment',
        message: 'Someone commented',
        actorId: 'user2',
      })

      expect(result).toBeNull()
      expect(prisma.notification.create).not.toHaveBeenCalled()
    })

    it('skips notification when actor is the same as recipient', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { createNotification } = await import('@/lib/services/notification')

      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)

      const result = await createNotification({
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        title: 'New comment',
        message: 'You commented on your own forecast',
        actorId: 'user1', // Same as userId
      })

      expect(result).toBeNull()
      expect(prisma.notification.create).not.toHaveBeenCalled()
    })

    it('returns null on error without throwing', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { createNotification } = await import('@/lib/services/notification')

      vi.mocked(prisma.notificationPreference.findUnique).mockRejectedValue(new Error('DB error'))

      const result = await createNotification({
        userId: 'user1',
        type: 'SYSTEM',
        title: 'System',
        message: 'Test',
      })

      expect(result).toBeNull() // Non-blocking
    })
  })

  describe('markNotificationRead', () => {
    it('updates notification with read=true and readAt', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { markNotificationRead } = await import('@/lib/services/notification')

      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 })

      await markNotificationRead('n1', 'user1')

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'n1', userId: 'user1' },
        data: { read: true, readAt: expect.any(Date) },
      })
    })
  })

  describe('markAllNotificationsRead', () => {
    it('marks all unread notifications as read', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { markAllNotificationsRead } = await import('@/lib/services/notification')

      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 5 })

      await markAllNotificationsRead('user1')

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user1', read: false },
        data: { read: true, readAt: expect.any(Date) },
      })
    })
  })

  describe('getUnreadCount', () => {
    it('returns count of unread notifications', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { getUnreadCount } = await import('@/lib/services/notification')

      vi.mocked(prisma.notification.count).mockResolvedValue(3)

      const count = await getUnreadCount('user1')

      expect(count).toBe(3)
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user1', read: false },
      })
    })
  })
})
