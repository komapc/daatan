import { prisma } from '@/lib/prisma'

/**
 * Transition ACTIVE predictions past their resolveByDatetime to PENDING status.
 * Called opportunistically from listing/detail API routes to keep statuses current
 * without requiring a cron job.
 *
 * Returns the number of predictions transitioned.
 */
export async function transitionExpiredPredictions(): Promise<number> {
  const result = await prisma.prediction.updateMany({
    where: {
      status: 'ACTIVE',
      resolveByDatetime: { lt: new Date() },
    },
    data: {
      status: 'PENDING',
    },
  })
  return result.count
}

/**
 * Transition a single prediction to PENDING if it's ACTIVE and past its deadline.
 * Used for individual prediction detail pages.
 */
export async function transitionIfExpired(predictionId: string): Promise<void> {
  await prisma.prediction.updateMany({
    where: {
      id: predictionId,
      status: 'ACTIVE',
      resolveByDatetime: { lt: new Date() },
    },
    data: {
      status: 'PENDING',
    },
  })
}
