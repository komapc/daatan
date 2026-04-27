import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

interface Entry {
  count: number
  windowStart: number
}

const store = new Map<string, Entry>()

// Evict stale entries every 10 minutes to prevent unbounded growth
let lastEvict = Date.now()
function maybeEvict(windowMs: number) {
  const now = Date.now()
  if (now - lastEvict < 10 * 60_000) return
  lastEvict = now
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > windowMs * 2) store.delete(key)
  }
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  maybeEvict(windowMs)

  const entry = store.get(key)
  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.windowStart + windowMs }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.windowStart + windowMs }
}

export function rateLimitResponse(resetAt: number): NextResponse {
  const retryAfterSecs = Math.ceil((resetAt - Date.now()) / 1000)
  return NextResponse.json(
    { error: 'Rate limit exceeded. Try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSecs),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    },
  )
}

/** Extract the real client IP from standard proxy headers. */
export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}
