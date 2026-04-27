export interface RetryOptions {
  /** Number of total attempts (default 3). */
  attempts?: number
  /** Delay before the 2nd attempt in ms; doubles with each retry (default 500). */
  initialDelayMs?: number
  /** Called after each failed attempt (before retrying). */
  onError?: (err: unknown, attempt: number, attemptsLeft: number) => void
}

/**
 * Retry `fn` up to `attempts` times with exponential backoff.
 * Throws the last error if all attempts fail.
 */
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const { attempts = 3, initialDelayMs = 500, onError } = options ?? {}

  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const attemptsLeft = attempts - attempt
      onError?.(err, attempt, attemptsLeft)
      if (attemptsLeft > 0) {
        await new Promise<void>((r) => setTimeout(r, initialDelayMs * 2 ** (attempt - 1)))
      }
    }
  }
  throw lastError
}
