import { createHash, timingSafeEqual } from 'crypto'

/** Constant-time comparison of two secrets to prevent timing attacks. */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}
