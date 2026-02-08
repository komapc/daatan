import { NextResponse } from 'next/server'
import { z } from 'zod'

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

  console.error(fallbackMessage, error)
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}
