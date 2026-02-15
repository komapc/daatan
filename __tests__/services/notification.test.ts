import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    notificationPreference: {
      findUnique: vi.fn(),
    },
  },
}))

// Must mock after prisma since the module imports prisma at load time
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
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
        id: 'notif1',
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        title: 'New Comment',
        message: 'Someone commented on your forecast',
      } as any)

      const result = await createNotification({
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        title: 'New Comment',
        message: 'Someone commented on your forecast',
        actorId: 'user2',
      })

      expect(result).not.toBeNull()
      expect(result?.id).toBe('notif1')
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user1',
          type: 'COMMENT_ON_FORECAST',
          title: 'New Comment',
        }),
      })
    })

    it('skips notification when in-app is disabled in preferences', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { createNotification } = await import('@/lib/services/notification')

      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
        id: 'pref1',
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        inApp: false,
        email: true,
        browserPush: false,
        telegram: false,
      } as any)

      const result = await createNotification({
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        title: 'New Comment',
        message: 'Someone commented on your forecast',
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
        title: 'New Comment',
        message: 'Self-comment',
        actorId: 'user1', // Same as userId
      })

      expect(result).toBeNull()
      expect(prisma.notification.create).not.toHaveBeenCalled()
    })

    it('returns null on DB error without throwing', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { createNotification } = await import('@/lib/services/notification')

      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.notification.create).mockRejectedValue(new Error('DB Error'))

      const result = await createNotification({
        userId: 'user1',
        type: 'SYSTEM',
        title: 'System notice',
        message: 'Test',
      })

      expect(result).toBeNull()
      // Should not throw — notification failures are non-blocking
    })
  })

  describe('markNotificationRead', () => {
    it('updates the notification to read', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { markNotificationRead } = await import('@/lib/services/notification')

      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 })

      await markNotificationRead('notif1', 'user1')

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif1', userId: 'user1' },
        data: { read: true, readAt: expect.any(Date) },
      })
    })
  })

  describe('markAllNotificationsRead', () => {
    it('updates all unread notifications for user', async () => {
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
