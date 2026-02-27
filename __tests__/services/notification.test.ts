import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null), // default: no existing notification to dedup
    },
    notificationPreference: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/services/push', () => ({
  dispatchBrowserPush: vi.fn(),
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

    it('updates existing unread notification instead of creating a duplicate', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { createNotification } = await import('@/lib/services/notification')

      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
      const existing = {
        id: 'existing-notif',
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        read: false,
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      }
      vi.mocked(prisma.notification.findFirst).mockResolvedValueOnce(existing as any)
      vi.mocked(prisma.notification.update).mockResolvedValue({ ...existing, message: 'Updated message' } as any)

      const result = await createNotification({
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        title: 'New Comment',
        message: 'Updated message',
        actorId: 'user2',
        predictionId: 'pred1',
      })

      expect(prisma.notification.create).not.toHaveBeenCalled()
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'existing-notif' },
        data: { message: 'Updated message', createdAt: expect.any(Date) },
      })
      expect(result).not.toBeNull()
    })

    it('creates a new notification when no unread duplicate exists within the window', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { createNotification } = await import('@/lib/services/notification')

      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.notification.findFirst).mockResolvedValueOnce(null) // no duplicate
      vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'new-notif' } as any)

      await createNotification({
        userId: 'user1',
        type: 'COMMENT_ON_FORECAST',
        title: 'New Comment',
        message: 'A comment',
        actorId: 'user2',
      })

      expect(prisma.notification.create).toHaveBeenCalledTimes(1)
      expect(prisma.notification.update).not.toHaveBeenCalled()
    })
  })

  describe('cleanupOldNotifications', () => {
    it('deletes notifications older than the given number of days', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { cleanupOldNotifications } = await import('@/lib/services/notification')

      vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 42 })

      const deleted = await cleanupOldNotifications(90)

      expect(deleted).toBe(42)
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: expect.any(Date) } },
      })

      // Verify the cutoff date is approximately 90 days ago
      const cutoffArg = vi.mocked(prisma.notification.deleteMany).mock.calls[0][0]?.where?.createdAt as any
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
      expect(cutoffArg.lt.getTime()).toBeCloseTo(ninetyDaysAgo, -4) // within ~10 seconds
    })

    it('uses 90 days as default', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { cleanupOldNotifications } = await import('@/lib/services/notification')

      vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 0 })

      await cleanupOldNotifications()

      const cutoffArg = vi.mocked(prisma.notification.deleteMany).mock.calls[0][0]?.where?.createdAt as any
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
      expect(cutoffArg.lt.getTime()).toBeCloseTo(ninetyDaysAgo, -4)
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
