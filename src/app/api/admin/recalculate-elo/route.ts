import { withAuth } from '@/lib/api-middleware'
import { replayEloHistory } from '@/lib/services/elo'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const log = createLogger('admin-recalculate-elo')

/**
 * POST /api/admin/recalculate-elo
 * Replays the full ELO history from stored brierScore values and writes the
 * resulting ratings back to User.eloRating. Idempotent — safe to run multiple times.
 */
export const POST = withAuth(async () => {
  const started = Date.now()
  log.info('ELO recalculation started')

  const finalRatings = await replayEloHistory()

  if (finalRatings.size === 0) {
    return Response.json({ updated: 0, message: 'No resolved predictions with multiple commitments found.' })
  }

  // Batch update all affected users
  await Promise.all(
    Array.from(finalRatings.entries()).map(([userId, eloRating]) =>
      prisma.user.update({ where: { id: userId }, data: { eloRating } }),
    ),
  )

  const elapsedMs = Date.now() - started
  log.info({ updated: finalRatings.size, elapsedMs }, 'ELO recalculation complete')

  return Response.json({
    updated: finalRatings.size,
    elapsedMs,
    message: `Updated ELO for ${finalRatings.size} users based on full history.`,
  })
}, { roles: ['ADMIN'] })
