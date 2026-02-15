import pino from 'pino'

/**
 * Structured logger for DAATAN.
 *
 * Uses pino for JSON-formatted, leveled logging.
 * - In production: JSON output at 'info' level (machine-parseable)
 * - In development: JSON output at 'debug' level
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info({ userId }, 'User signed in')
 *   logger.error({ err, predictionId }, 'Failed to resolve prediction')
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
  }),
})

/** Create a child logger scoped to a module/domain. */
export const createLogger = (module: string) => logger.child({ module })
