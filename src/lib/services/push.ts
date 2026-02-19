import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const log = createLogger('push-service')

/**
 * Dispatch a browser push notification to all of a user's subscribed devices.
 * Fire-and-forget: never throws, logs errors. Mirrors telegram.ts pattern.
 */
export async function dispatchBrowserPush(
  userId: string,
  notification: { title: string; message: string; link?: string; type: string },
): Promise<void> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

  if (!vapidPublicKey || !vapidPrivateKey) {
    log.debug('Web push not configured (missing VAPID keys)')
    return
  }

  webpush.setVapidDetails(
    'mailto:push@daatan.com',
    vapidPublicKey,
    vapidPrivateKey,
  )

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })

  if (subscriptions.length === 0) return

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    url: notification.link || '/',
    type: notification.type,
  })

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        )
        // Update lastUsedAt on success
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastUsedAt: new Date() },
        })
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired or invalid — clean up
          log.info({ endpoint: sub.endpoint }, 'Removing stale push subscription')
          await prisma.pushSubscription.delete({ where: { id: sub.id } })
        } else {
          log.error({ err: error, endpoint: sub.endpoint }, 'Failed to send push notification')
        }
      }
    }),
  )

  const failed = results.filter((r) => r.status === 'rejected').length
  if (failed > 0) {
    log.warn({ userId, total: subscriptions.length, failed }, 'Some push notifications failed')
  }
}
