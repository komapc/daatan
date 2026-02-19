import { Bell } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUnreadCount } from '@/lib/services/notification'
import NotificationList from '@/components/notifications/NotificationList'

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/notifications')
  }

  const userId = session.user.id

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.notification.count({ where: { userId } }),
    getUnreadCount(userId),
  ])

  // Serialize dates for client component
  const serialized = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6 lg:mb-8">
        <Bell className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Notifications</h1>
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 text-xs font-bold text-blue-600 bg-blue-100 rounded-full">
            {unreadCount} unread
          </span>
        )}
      </div>
      <NotificationList
        initialNotifications={serialized}
        initialTotal={total}
        initialUnreadCount={unreadCount}
      />
    </div>
  )
}
