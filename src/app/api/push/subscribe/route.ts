import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@/lib/validations/push'
import { handleRouteError } from '@/lib/api-error'

// POST /api/push/subscribe — Upsert a push subscription
export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json()
    const data = pushSubscribeSchema.parse(body)

    const userAgent = request.headers.get('user-agent') || undefined

    await prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        userId: user.id,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent,
      },
      update: {
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent,
        userId: user.id,
      },
    })

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

    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: data.endpoint,
        userId: user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to remove push subscription')
  }
})
