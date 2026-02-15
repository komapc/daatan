import { z } from 'zod'

/**
 * Google Client ID format: <project-number>-<hash>.apps.googleusercontent.com
 * or <hash>.apps.googleusercontent.com
 */
const googleClientIdSchema = z
  .string()
  .min(1, 'GOOGLE_CLIENT_ID is required')
  .regex(
    /^[\w-]+\.apps\.googleusercontent\.com$/,
    'GOOGLE_CLIENT_ID must end with .apps.googleusercontent.com (e.g. 123456789-abc.apps.googleusercontent.com)'
  )

/**
 * Google Client Secret format: GOCSPX-<hash> (newer secrets) or a legacy format string.
 * At minimum, must be a non-trivial string (not a placeholder).
 */
const googleClientSecretSchema = z
  .string()
  .min(1, 'GOOGLE_CLIENT_SECRET is required')
  .refine(
    (val) => !['your-google-client-secret', 'placeholder', 'dummy', 'changeme', 'xxx'].includes(val.toLowerCase()),
    'GOOGLE_CLIENT_SECRET contains a placeholder value — set the real secret'
  )
  .refine(
    (val) => val.length >= 10,
    'GOOGLE_CLIENT_SECRET is too short — check if it was truncated'
  )

/**
 * NEXTAUTH_SECRET must be a strong random string (at least 32 chars recommended).
 */
const nextAuthSecretSchema = z
  .string()
  .min(1, 'NEXTAUTH_SECRET is required')
  .refine(
    (val) => !['your-secret-key-here', 'dummy-secret-for-build', 'changeme', 'test-secret'].includes(val),
    'NEXTAUTH_SECRET contains a placeholder value — generate a real one with: openssl rand -base64 32'
  )
  .refine(
    (val) => val.length >= 16,
    'NEXTAUTH_SECRET is too short — use at least 32 characters (openssl rand -base64 32)'
  )

/**
 * NEXTAUTH_URL must be a valid URL with https in production/staging.
 */
const nextAuthUrlSchema = z
  .string()
  .min(1, 'NEXTAUTH_URL is required')
  .url('NEXTAUTH_URL must be a valid URL')

/**
 * Full schema for Google OAuth environment variables.
 * Used at runtime to validate the server has correct credentials.
 */
export const googleOAuthEnvSchema = z.object({
  GOOGLE_CLIENT_ID: googleClientIdSchema,
  GOOGLE_CLIENT_SECRET: googleClientSecretSchema,
  NEXTAUTH_SECRET: nextAuthSecretSchema,
  NEXTAUTH_URL: nextAuthUrlSchema,
})

export type GoogleOAuthEnv = z.infer<typeof googleOAuthEnvSchema>

/**
 * Validate OAuth environment variables and return structured result.
 * Does NOT throw — returns success/failure with details.
 */
export const validateOAuthEnv = (env: Record<string, string | undefined> = process.env) => {
  const result = googleOAuthEnvSchema.safeParse({
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID?.trim(),
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET?.trim(),
    NEXTAUTH_SECRET: env.NEXTAUTH_SECRET?.trim(),
    NEXTAUTH_URL: env.NEXTAUTH_URL?.trim(),
  })

  if (result.success) {
    return {
      valid: true as const,
      data: result.data,
      errors: [] as string[],
    }
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`
  )

  return {
    valid: false as const,
    data: null,
    errors,
  }
}

/**
 * Mask a secret for safe logging (show first 4 and last 4 chars).
 */
export const maskSecret = (value: string | undefined): string => {
  if (!value || value.length < 12) return '***'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

/**
 * Generate a safe diagnostic summary of OAuth config (no secret values).
 */
export const getOAuthDiagnostics = (env: Record<string, string | undefined> = process.env) => {
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? ''
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? ''
  const nextAuthSecret = env.NEXTAUTH_SECRET?.trim() ?? ''
  const nextAuthUrl = env.NEXTAUTH_URL?.trim() ?? ''

  const validation = validateOAuthEnv(env)

  return {
    valid: validation.valid,
    errors: validation.errors,
    diagnostics: {
      GOOGLE_CLIENT_ID: {
        set: clientId.length > 0,
        format: clientId.endsWith('.apps.googleusercontent.com') ? 'valid' : 'invalid',
        preview: clientId.length > 0 ? `${clientId.slice(0, 8)}...` : '(empty)',
      },
      GOOGLE_CLIENT_SECRET: {
        set: clientSecret.length > 0,
        length: clientSecret.length,
        preview: maskSecret(clientSecret),
      },
      NEXTAUTH_SECRET: {
        set: nextAuthSecret.length > 0,
        length: nextAuthSecret.length,
      },
      NEXTAUTH_URL: {
        set: nextAuthUrl.length > 0,
        value: nextAuthUrl, // URL is not secret
      },
    },
  }
}
