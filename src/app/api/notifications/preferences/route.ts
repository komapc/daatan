import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { handleRouteError } from '@/lib/api-error'
import { NOTIFICATION_TYPE_DEFAULTS, getNotificationPreferences, upsertNotificationPreference } from '@/lib/services/notification'
import type { NotificationType } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET /api/notifications/preferences — Return merged defaults + stored preferences
export const GET = withAuth(async (_request, user) => {
  try {
    const preferences = await getNotificationPreferences(user.id)
    return NextResponse.json({ preferences })
  } catch (error) {
    return handleRouteError(error, 'Failed to fetch notification preferences')
  }
})

// PATCH /api/notifications/preferences — Upsert a single type preference
export const PATCH = withAuth(async (request, user) => {
  try {
    const body = await request.json()
    const { type, inApp, email, browserPush } = body as {
      type: NotificationType
      inApp?: boolean
      email?: boolean
      browserPush?: boolean
    }

    if (!type || !NOTIFICATION_TYPE_DEFAULTS[type]) {
      return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 })
    }

    const preference = await upsertNotificationPreference(user.id, type, { inApp, email, browserPush })
    return NextResponse.json(preference)
  } catch (error) {
    return handleRouteError(error, 'Failed to update notification preference')
  }
})
