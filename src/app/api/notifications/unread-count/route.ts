import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getUnreadCount } from '@/lib/services/notification'

export const dynamic = 'force-dynamic'

// GET /api/notifications/unread-count — Lightweight endpoint for badge polling
// Returns 0 if not authenticated instead of 401, for better UX
export const GET = async () => {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      // Return 0 instead of 401 for unauthenticated requests (better for badge polling)
      return NextResponse.json({ count: 0 })
    }

    const count = await getUnreadCount(session.user.id)
    return NextResponse.json({ count })
  } catch (error) {
    console.error('Failed to get unread notification count:', error)
    return NextResponse.json({ count: 0 }, { status: 500 })
  }
}
