import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { dispatchBrowserPush } from '@/lib/services/push'
import type { NotificationType } from '@prisma/client'

const log = createLogger('notification-service')

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  predictionId?: string
  commentId?: string
  actorId?: string
}

/**
 * Create a notification for a user.
 * Checks user preferences before creating — if the user has disabled
 * in-app notifications for this type, the notification is not created.
 * Dispatches browser push if enabled.
 */
export const createNotification = async (input: CreateNotificationInput) => {
  try {
    // Don't notify users about their own actions
    if (input.actorId && input.actorId === input.userId) {
      return null
    }

    // Check user preference for this notification type
    const preference = await prisma.notificationPreference.findUnique({
      where: {
        userId_type: {
          userId: input.userId,
          type: input.type,
        },
      },
    })

    // Determine channel enablement (fall back to defaults if no preference row)
    const defaults = NOTIFICATION_TYPE_DEFAULTS[input.type]
    const inAppEnabled = preference ? preference.inApp : defaults.inApp
    const browserPushEnabled = preference ? preference.browserPush : defaults.browserPush

    // Create in-app notification if enabled
    let notification = null
    if (inAppEnabled) {
      // Dedup: if an unread notification with the same (userId, type, actorId, predictionId)
      // already exists within the last hour, update it instead of creating a duplicate.
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const existing = await prisma.notification.findFirst({
        where: {
          userId: input.userId,
          type: input.type,
          actorId: input.actorId ?? null,
          predictionId: input.predictionId ?? null,
          read: false,
          createdAt: { gte: oneHourAgo },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (existing) {
        notification = await prisma.notification.update({
          where: { id: existing.id },
          data: { message: input.message, createdAt: new Date() },
        })
        log.debug({ id: existing.id, type: input.type }, 'Deduped notification — updated existing')
      } else {
        notification = await prisma.notification.create({
          data: {
            userId: input.userId,
            type: input.type,
            title: input.title,
            message: input.message,
            link: input.link,
            predictionId: input.predictionId,
            commentId: input.commentId,
            actorId: input.actorId,
          },
        })
      }
    } else {
      log.debug({ userId: input.userId, type: input.type }, 'In-app notification disabled by user preference')
    }

    // Dispatch browser push (fire-and-forget)
    if (browserPushEnabled) {
      dispatchBrowserPush(input.userId, {
        title: input.title,
        message: input.message,
        link: input.link,
        type: input.type,
      })
    }

    return notification
  } catch (error) {
    log.error({ err: error, input }, 'Failed to create notification')
    return null // Non-blocking: don't fail the parent operation
  }
}

/**
 * Mark a notification as read.
 */
export const markNotificationRead = async (notificationId: string, userId: string) => {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true, readAt: new Date() },
  })
}

/**
 * Mark all notifications as read for a user.
 */
export const markAllNotificationsRead = async (userId: string) => {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  })
}

/**
 * Get unread notification count for a user.
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  return prisma.notification.count({
    where: { userId, read: false },
  })
}

/**
 * Delete notifications older than the given number of days (default: 90).
 * Intended to be called from a scheduled cron job.
 * Returns the number of deleted rows.
 */
export const cleanupOldNotifications = async (olderThanDays = 90): Promise<number> => {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  const result = await prisma.notification.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  log.info({ deleted: result.count, olderThanDays }, 'Notification cleanup completed')
  return result.count
}

/**
 * Default notification preferences for each type.
 */
export const NOTIFICATION_TYPE_DEFAULTS: Record<NotificationType, { inApp: boolean; email: boolean; browserPush: boolean }> = {
  COMMITMENT_RESOLVED: { inApp: true, email: true, browserPush: true },
  COMMENT_ON_FORECAST: { inApp: true, email: false, browserPush: true },
  REPLY_TO_COMMENT: { inApp: true, email: false, browserPush: true },
  NEW_COMMITMENT: { inApp: true, email: false, browserPush: false },
  MENTION: { inApp: true, email: true, browserPush: true },
  SYSTEM: { inApp: true, email: true, browserPush: false },
}
