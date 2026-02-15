import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/notifications/route'
import { PATCH } from '@/app/api/notifications/[id]/route'

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('next-auth/next', () => ({ getServerSession: mockGetServerSession }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

// Mock the notification service
vi.mock('@/lib/services/notification', () => ({
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}))

describe('Notifications API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/notifications', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/notifications')
      const response = await GET(request, { params: {} } as any)

      expect(response.status).toBe(401)
    })

    it('returns notifications with pagination and unread count', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com', role: 'USER' },
      })

      const { prisma } = await import('@/lib/prisma')

      const mockNotifications = [
        { id: 'n1', type: 'COMMENT_ON_FORECAST', title: 'New comment', read: false },
        { id: 'n2', type: 'COMMITMENT_RESOLVED', title: 'Resolved', read: true },
      ]

      vi.mocked(prisma.notification.findMany).mockResolvedValue(mockNotifications as any)
      vi.mocked(prisma.notification.count)
        .mockResolvedValueOnce(2) // total
        .mockResolvedValueOnce(1) // unread

      const request = new NextRequest('http://localhost/api/notifications?page=1&limit=20')
      const response = await GET(request, { params: {} } as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.notifications).toHaveLength(2)
      expect(data.unreadCount).toBe(1)
      expect(data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      })
    })

    it('filters by unreadOnly when requested', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com', role: 'USER' },
      })

      const { prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.notification.findMany).mockResolvedValue([])
      vi.mocked(prisma.notification.count).mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/notifications?unreadOnly=true')
      const response = await GET(request, { params: {} } as any)

      expect(response.status).toBe(200)
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user1', read: false },
        })
      )
    })
  })

  describe('POST /api/notifications (mark all read)', () => {
    it('marks all notifications as read', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com', role: 'USER' },
      })

      const { markAllNotificationsRead } = await import('@/lib/services/notification')

      const request = new NextRequest('http://localhost/api/notifications', {
        method: 'POST',
      })
      const response = await POST(request, { params: {} } as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(markAllNotificationsRead).toHaveBeenCalledWith('user1')
    })

    it('returns 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/notifications', {
        method: 'POST',
      })
      const response = await POST(request, { params: {} } as any)

      expect(response.status).toBe(401)
    })
  })

  describe('PATCH /api/notifications/[id]', () => {
    it('marks a single notification as read', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com', role: 'USER' },
      })

      const { markNotificationRead } = await import('@/lib/services/notification')

      const request = new NextRequest('http://localhost/api/notifications/n1', {
        method: 'PATCH',
      })
      const response = await PATCH(request, { params: { id: 'n1' } })

      expect(response.status).toBe(200)
      expect(markNotificationRead).toHaveBeenCalledWith('n1', 'user1')
    })

    it('returns 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/notifications/n1', {
        method: 'PATCH',
      })
      const response = await PATCH(request, { params: { id: 'n1' } })

      expect(response.status).toBe(401)
    })
  })
})
