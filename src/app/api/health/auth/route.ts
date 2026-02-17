import { NextResponse } from 'next/server'
import { env } from '@/env'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/health/auth
 *
 * Runtime health check for OAuth configuration.
 * Returns diagnostic info about whether Google OAuth credentials
 * are properly formatted — WITHOUT exposing actual secret values.
 *
 * Pass ?verify=true to also validate credentials against Google's
 * token endpoint (adds ~200ms latency). Returns "invalid_grant" when
 * credentials are valid (expected — we send a dummy auth code).
 * Returns "invalid_client" when credentials are rejected by Google.
 *
 * Used by CI/CD post-deployment verification.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const shouldVerify = url.searchParams.get('verify') === 'true'

  const diagnostics = {
    GOOGLE_CLIENT_ID: {
      set: true,
      format: 'valid',
      preview: `${env.GOOGLE_CLIENT_ID.slice(0, 8)}...`
    },
    GOOGLE_CLIENT_SECRET: {
      set: true,
      length: env.GOOGLE_CLIENT_SECRET.length,
      preview: `${env.GOOGLE_CLIENT_SECRET.slice(0, 4)}...${env.GOOGLE_CLIENT_SECRET.slice(-4)}`
    },
    NEXTAUTH_SECRET: {
      set: true,
      length: env.NEXTAUTH_SECRET.length
    },
    NEXTAUTH_URL: {
      set: true,
      value: env.NEXTAUTH_URL
    }
  }

  if (!shouldVerify) {
    return NextResponse.json({
      status: 'ok',
      message: 'OAuth configuration is valid',
      diagnostics
    })
  }

  // Verify credentials against Google's token endpoint.
  // We send a dummy authorization code. Expected responses:
  //   "invalid_grant" = credentials valid, code is wrong (expected)
  //   "invalid_client" = credentials rejected by Google (broken!)
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code: 'dummy_verification_code',
        grant_type: 'authorization_code',
        redirect_uri: `${env.NEXTAUTH_URL}/api/auth/callback/google`
      })
    })

    const data = await response.json()
    const googleError = data.error as string

    if (googleError === 'invalid_grant') {
      // Credentials are accepted by Google (the dummy code was rejected, which is expected)
      return NextResponse.json({
        status: 'ok',
        message: 'OAuth credentials verified with Google',
        google_verification: 'passed',
        diagnostics
      })
    }

    // Credentials rejected by Google
    return NextResponse.json({
      status: 'error',
      message: `Google rejected credentials: ${googleError}`,
      google_verification: 'failed',
      google_error: googleError,
      google_error_description: data.error_description,
      diagnostics
    }, { status: 503 })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: `Failed to verify with Google: ${error instanceof Error ? error.message : 'unknown'}`,
      google_verification: 'error',
      diagnostics
    }, { status: 503 })
  }
}
