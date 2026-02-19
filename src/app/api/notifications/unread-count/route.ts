import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { getUnreadCount } from '@/lib/services/notification'

export const dynamic = 'force-dynamic'

// GET /api/notifications/unread-count — Lightweight endpoint for badge polling
export const GET = withAuth(async (_request, user) => {
  const count = await getUnreadCount(user.id)
  return NextResponse.json({ count })
})
