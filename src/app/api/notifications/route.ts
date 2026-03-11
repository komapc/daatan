import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { markAllNotificationsRead } from '@/lib/services/notification'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/notifications - List notifications for current user
export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const rawLimit = parseInt(searchParams.get('limit') || '20')
  const limit = Math.min(100, Math.max(1, rawLimit))
  const unreadOnly = searchParams.get('unreadOnly') === 'true'

  const where = {
    userId: user.id,
    ...(unreadOnly && { read: false }),
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ])

  // Enrich with actor info
  const actorIds = [...new Set(notifications.map(n => n.actorId).filter(Boolean) as string[])]
  const actors = actorIds.length > 0 
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, username: true, image: true, avatarUrl: true }
      })
    : []
  
  const actorMap = Object.fromEntries(actors.map(a => [a.id, a]))

  const enrichedNotifications = notifications.map(n => ({
    ...n,
    actor: n.actorId ? actorMap[n.actorId] : null
  }))

  return NextResponse.json({
    notifications: enrichedNotifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
})

// POST /api/notifications - Mark all as read
export const POST = withAuth(async (_request, user) => {
  await markAllNotificationsRead(user.id)
  return NextResponse.json({ success: true })
})
