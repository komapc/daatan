import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { markAllNotificationsRead } from '@/lib/services/notification'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/notifications - List notifications for current user
export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
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

  return NextResponse.json({
    notifications,
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
