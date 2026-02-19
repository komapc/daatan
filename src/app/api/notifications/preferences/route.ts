import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { handleRouteError } from '@/lib/api-error'
import { NOTIFICATION_TYPE_DEFAULTS } from '@/lib/services/notification'
import type { NotificationType } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET /api/notifications/preferences — Return merged defaults + stored preferences
export const GET = withAuth(async (_request, user) => {
  try {
    const stored = await prisma.notificationPreference.findMany({
      where: { userId: user.id },
    })

    const storedMap = new Map(stored.map((p) => [p.type, p]))

    // Merge defaults with stored preferences
    const preferences = Object.entries(NOTIFICATION_TYPE_DEFAULTS).map(([type, defaults]) => {
      const pref = storedMap.get(type as NotificationType)
      return {
        type: type as NotificationType,
        inApp: pref ? pref.inApp : defaults.inApp,
        email: pref ? pref.email : defaults.email,
        browserPush: pref ? pref.browserPush : defaults.browserPush,
      }
    })

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

    const defaults = NOTIFICATION_TYPE_DEFAULTS[type]
    const data = {
      inApp: inApp ?? defaults.inApp,
      email: email ?? defaults.email,
      browserPush: browserPush ?? defaults.browserPush,
    }

    const preference = await prisma.notificationPreference.upsert({
      where: {
        userId_type: { userId: user.id, type },
      },
      create: {
        userId: user.id,
        type,
        ...data,
      },
      update: data,
    })

    return NextResponse.json(preference)
  } catch (error) {
    return handleRouteError(error, 'Failed to update notification preference')
  }
})
