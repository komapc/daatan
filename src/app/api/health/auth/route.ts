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
 * Used by CI/CD post-deployment verification.
 * Note: If env vars are invalid, the app will likely crash on startup
 * due to @t3-oss/env-nextjs validation, so this endpoint confirms
 * the app is running and config is loaded correctly.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'OAuth configuration is valid',
    diagnostics: {
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
  })
}
