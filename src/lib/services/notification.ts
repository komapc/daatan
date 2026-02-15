import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
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
 */
export const createNotification = async (input: CreateNotificationInput) => {
  try {
    // Check user preference for this notification type
    const preference = await prisma.notificationPreference.findUnique({
      where: {
        userId_type: {
          userId: input.userId,
          type: input.type,
        },
      },
    })

    // If preference exists and in-app is disabled, skip in-app notification
    if (preference && !preference.inApp) {
      log.debug({ userId: input.userId, type: input.type }, 'In-app notification disabled by user preference')
      return null
    }

    // Don't notify users about their own actions
    if (input.actorId && input.actorId === input.userId) {
      return null
    }

    const notification = await prisma.notification.create({
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

    // TODO: Dispatch to other channels (email, push, telegram) based on preferences

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
 * Get default notification preferences for a new user.
 * Called during user creation to seed preferences.
 */
export const NOTIFICATION_TYPE_DEFAULTS: Record<NotificationType, { inApp: boolean; email: boolean }> = {
  COMMITMENT_RESOLVED: { inApp: true, email: true },
  COMMENT_ON_FORECAST: { inApp: true, email: false },
  REPLY_TO_COMMENT: { inApp: true, email: false },
  NEW_COMMITMENT: { inApp: true, email: false },
  MENTION: { inApp: true, email: true },
  SYSTEM: { inApp: true, email: true },
}
