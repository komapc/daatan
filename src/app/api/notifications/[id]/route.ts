import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { markNotificationRead } from '@/lib/services/notification'

// PATCH /api/notifications/[id] - Mark single notification as read
export const PATCH = withAuth(async (_request, user, { params }) => {
  await markNotificationRead(params.id, user.id)
  return NextResponse.json({ success: true })
})
