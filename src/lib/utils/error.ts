/**
 * Converts an unknown catch value to an Error instance.
 * Use in catch blocks instead of `catch (e: any)`.
 *
 * @example
 * catch (e) {
 *   log.error({ err: toError(e) }, 'Something failed')
 *   throw toError(e)
 * }
 */
export function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e))
}
