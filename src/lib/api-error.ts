import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'

const log = createLogger('api-error')

/**
 * Standard API error response shape:
 * { error: string, details?: Array<{ path, message }> }
 *
 * - `error` is always a human-readable string
 * - `details` is only present for validation errors (Zod)
 */

interface ValidationDetail {
  path: PropertyKey[]
  message: string
}

interface ApiErrorBody {
  error: string
  details?: ValidationDetail[]
}

/** Return a standardised JSON error response. */
export function apiError(message: string, status: number): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Handle caught errors at the end of a route handler.
 * - ZodError → 400 with field-level details
 * - Everything else → 500 with generic message
 * - In staging: include error details for debugging
 */
export function handleRouteError(
  error: unknown,
  fallbackMessage = 'Internal server error',
): NextResponse<ApiErrorBody> {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      },
      { status: 400 },
    )
  }

  log.error({ err: error }, fallbackMessage)

  // Include error details in staging for easier debugging
  const isStaging = process.env.NEXT_PUBLIC_ENV === 'staging'
  const body: ApiErrorBody = { error: fallbackMessage }
  if (isStaging && error instanceof Error) {
    body.details = [{ path: [], message: error.message }]
  }

  return NextResponse.json(body, { status: 500 })
}
