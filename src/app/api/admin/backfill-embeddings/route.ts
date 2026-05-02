import { withAuth } from '@/lib/api-middleware'
import { embedAndStoreForecast } from '@/lib/services/embedding'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const log = createLogger('admin-backfill-embeddings')

const BATCH_SIZE = 10

/**
 * POST /api/admin/backfill-embeddings
 * Generates and stores embeddings for all predictions that currently lack one.
 * Processes in small batches to stay within Gemini API rate limits.
 * Idempotent — safe to run multiple times.
 */
export const POST = withAuth(async () => {
  const started = Date.now()

  const missing = await prisma.$queryRaw<{ id: string; claimText: string }[]>`
    SELECT id, "claimText" FROM predictions WHERE embedding IS NULL
  `

  log.info({ total: missing.length }, 'Backfill embeddings started')

  let done = 0
  let failed = 0

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async ({ id, claimText }) => {
        try {
          await embedAndStoreForecast(id, claimText)
          done++
        } catch (err) {
          log.error({ err, id }, 'Backfill embed failed for prediction')
          failed++
        }
      })
    )
  }

  const elapsedMs = Date.now() - started
  log.info({ done, failed, elapsedMs }, 'Backfill embeddings complete')

  return Response.json({ done, failed, total: missing.length, elapsedMs })
}, { roles: ['ADMIN'] })
