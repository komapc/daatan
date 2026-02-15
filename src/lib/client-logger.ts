/**
 * Client-side logger for browser components.
 *
 * Wraps console.* so we have a single import to swap to
 * a real browser logging service later (e.g. Sentry, LogRocket).
 */

type LogData = Record<string, unknown>

const formatMsg = (module: string, msg: string) =>
  `[${module}] ${msg}`

export const createClientLogger = (module: string) => ({
  error(data: LogData | string, msg?: string) {
    if (typeof data === 'string') {
      console.error(formatMsg(module, data))
    } else {
      console.error(formatMsg(module, msg ?? ''), data)
    }
  },
  warn(data: LogData | string, msg?: string) {
    if (typeof data === 'string') {
      console.warn(formatMsg(module, data))
    } else {
      console.warn(formatMsg(module, msg ?? ''), data)
    }
  },
  info(data: LogData | string, msg?: string) {
    if (typeof data === 'string') {
      console.info(formatMsg(module, data))
    } else {
      console.info(formatMsg(module, msg ?? ''), data)
    }
  },
  debug(data: LogData | string, msg?: string) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof data === 'string') {
        console.debug(formatMsg(module, data))
      } else {
        console.debug(formatMsg(module, msg ?? ''), data)
      }
    }
  },
})
