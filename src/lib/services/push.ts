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

  const successIds: string[] = []
  const staleIds: string[] = []

  const sendWithRetry = async (sub: typeof subscriptions[number], attemptsLeft = 2): Promise<void> => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      successIds.push(sub.id)
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode === 410 || statusCode === 404) {
        staleIds.push(sub.id)
      } else if (attemptsLeft > 1) {
        await new Promise((r) => setTimeout(r, 500))
        return sendWithRetry(sub, attemptsLeft - 1)
      } else {
        log.error({ err: error, endpoint: sub.endpoint }, 'Failed to send push notification after retries')
      }
    }
  }

  await Promise.allSettled(subscriptions.map((sub) => sendWithRetry(sub)))

  // Batch DB operations rather than N individual queries
  const now = new Date()
  await Promise.allSettled([
    successIds.length > 0
      ? prisma.pushSubscription.updateMany({
          where: { id: { in: successIds } },
          data: { lastUsedAt: now },
        })
      : Promise.resolve(),
    staleIds.length > 0
      ? (log.info({ count: staleIds.length }, 'Removing stale push subscriptions'),
        prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } }))
      : Promise.resolve(),
  ])

  const failed = subscriptions.length - successIds.length - staleIds.length
  if (failed > 0) {
    log.warn({ userId, total: subscriptions.length, failed }, 'Some push notifications failed')
  }
}
