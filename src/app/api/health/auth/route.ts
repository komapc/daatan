import { NextResponse } from 'next/server'
import { getOAuthDiagnostics } from '@/lib/validations/env'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/health/auth
 *
 * Runtime health check for OAuth configuration.
 * Returns diagnostic info about whether Google OAuth credentials
 * are properly formatted — WITHOUT exposing actual secret values.
 *
 * Used by CI/CD post-deployment verification to catch misconfigured secrets.
 */
export async function GET() {
  const diagnostics = getOAuthDiagnostics()

  if (!diagnostics.valid) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'OAuth configuration is invalid',
        errors: diagnostics.errors,
        diagnostics: diagnostics.diagnostics,
      },
      { status: 503 }
    )
  }

  return NextResponse.json({
    status: 'ok',
    message: 'OAuth configuration is valid',
    diagnostics: diagnostics.diagnostics,
  })
}
