import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@/lib/validations/push'
import { handleRouteError } from '@/lib/api-error'
import { upsertPushSubscription, deletePushSubscription } from '@/lib/services/push'

// POST /api/push/subscribe — Upsert a push subscription
export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json()
    const data = pushSubscribeSchema.parse(body)

    const userAgent = request.headers.get('user-agent') || undefined

    await upsertPushSubscription(user.id, data.endpoint, data.keys.p256dh, data.keys.auth, userAgent)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to save push subscription')
  }
})

// DELETE /api/push/subscribe — Remove a push subscription
export const DELETE = withAuth(async (request, user) => {
  try {
    const body = await request.json()
    const data = pushUnsubscribeSchema.parse(body)

    await deletePushSubscription(user.id, data.endpoint)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to remove push subscription')
  }
})
