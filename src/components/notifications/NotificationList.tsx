'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  MessageSquare,
  Reply,
  Target,
  AtSign,
  Megaphone,
  CheckCheck,
  Loader2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { NotificationType } from '@prisma/client'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

interface NotificationListProps {
  initialNotifications: Notification[]
  initialTotal: number
  initialUnreadCount: number
}

const TYPE_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  COMMITMENT_RESOLVED: Target,
  COMMENT_ON_FORECAST: MessageSquare,
  REPLY_TO_COMMENT: Reply,
  NEW_COMMITMENT: Bell,
  MENTION: AtSign,
  SYSTEM: Megaphone,
}

export default function NotificationList({
  initialNotifications,
  initialTotal,
  initialUnreadCount,
}: NotificationListProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [total, setTotal] = useState(initialTotal)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAllRead, setMarkingAllRead] = useState(false)

  const page = Math.ceil(notifications.length / 20)
  const hasMore = notifications.length < total

  const handleClick = useCallback(async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      try {
        const res = await fetch(`/api/notifications/${notification.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read: true }),
        })
        if (res.ok) {
          router.refresh() // invalidate router cache so next visit shows updated state
        } else {
          // Rollback
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, read: false } : n)),
          )
          setUnreadCount((prev) => prev + 1)
        }
      } catch {
        // Rollback on network error
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: false } : n)),
        )
        setUnreadCount((prev) => prev + 1)
      }
    }

    // Navigate to link
    if (notification.link) {
      router.push(notification.link)
    }
  }, [router])

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAllRead(true)
    try {
      const res = await fetch('/api/notifications', { method: 'POST' })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        setUnreadCount(0)
        router.refresh() // invalidate router cache so next visit shows updated state
      }
    } catch {
      // Silently fail
    } finally {
      setMarkingAllRead(false)
    }
  }, [])

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/notifications?page=${page + 1}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setNotifications((prev) => [...prev, ...data.notifications])
        setTotal(data.pagination.total)
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingMore(false)
    }
  }, [page])

  if (notifications.length === 0) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 sm:p-12 text-center">
        <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400 text-base sm:text-lg">No notifications yet</p>
        <p className="text-gray-400 text-sm mt-1">
          When someone interacts with your forecasts, you&apos;ll see it here.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header actions */}
      {unreadCount > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={handleMarkAllRead}
            disabled={markingAllRead}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
          >
            {markingAllRead ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4" />
            )}
            Mark all as read
          </button>
        </div>
      )}

      {/* Notification list */}
      <div className="space-y-1">
        {notifications.map((notification) => {
          const Icon = TYPE_ICONS[notification.type] || Bell

          return (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={`w-full text-left flex items-start gap-3 p-4 rounded-lg transition-colors hover:bg-gray-50 ${
                !notification.read ? 'bg-blue-50/50' : ''
              }`}
            >
              <div className={`mt-0.5 p-2 rounded-full shrink-0 ${
                !notification.read ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                    {notification.title}
                  </p>
                  {!notification.read && (
                    <span className="mt-1.5 w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            {loadingMore ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              `Load more (${total - notifications.length} remaining)`
            )}
          </button>
        </div>
      )}
    </div>
  )
}
