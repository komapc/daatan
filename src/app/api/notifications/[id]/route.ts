import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { apiError } from '@/lib/api-error'
import { markNotificationRead } from '@/lib/services/notification'

// PATCH /api/notifications/[id] - Mark single notification as read
// Ownership is enforced by markNotificationRead via WHERE { id, userId } —
// count === 0 means either the notification doesn't exist or belongs to someone else.
export const PATCH = withAuth(async (_request, user, { params }) => {
  const result = await markNotificationRead(params.id, user.id)
  if (result.count === 0) {
    return apiError('Notification not found', 404)
  }
  return NextResponse.json({ success: true })
})
