import { describe, it, expect } from 'vitest'
import {
  validateOAuthEnv,
  maskSecret,
  getOAuthDiagnostics,
  googleOAuthEnvSchema,
} from '@/lib/validations/env'

/**
 * Tests for environment variable validation.
 * Ensures Google OAuth credentials have the correct format BEFORE deployment,
 * catching misconfiguration (wrong key, placeholder values, truncation) early.
 */

const validEnv = {
  GOOGLE_CLIENT_ID: '123456789-abcdef.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-abcdef123456789',
  NEXTAUTH_SECRET: 'a-very-long-random-secret-string-at-least-32-chars',
  NEXTAUTH_URL: 'https://daatan.com',
}

describe('googleOAuthEnvSchema', () => {
  describe('GOOGLE_CLIENT_ID', () => {
    it('accepts valid Google Client ID format', () => {
      const result = googleOAuthEnvSchema.safeParse(validEnv)
      expect(result.success).toBe(true)
    })

    it('rejects empty GOOGLE_CLIENT_ID', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_ID: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects client ID without .apps.googleusercontent.com suffix', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_ID: 'some-random-string',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('.apps.googleusercontent.com')
      }
    })

    it('rejects client ID that looks like a secret (GOCSPX-)', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_ID: 'GOCSPX-abcdef123456789',
      })
      expect(result.success).toBe(false)
    })

    it('accepts client ID with complex project number prefix', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_ID: '987654321012-a1b2c3d4e5f6g7h8i9j0.apps.googleusercontent.com',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('GOOGLE_CLIENT_SECRET', () => {
    it('accepts valid GOCSPX- prefixed secret', () => {
      const result = googleOAuthEnvSchema.safeParse(validEnv)
      expect(result.success).toBe(true)
    })

    it('rejects empty secret', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_SECRET: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects placeholder value "your-google-client-secret"', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_SECRET: 'your-google-client-secret',
      })
      expect(result.success).toBe(false)
    })

    it('rejects very short secrets (likely truncated)', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_SECRET: 'abc',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('too short')
      }
    })

    it('accepts legacy format secrets (non-GOCSPX)', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_SECRET: 'a1b2c3d4e5f6g7h8i9j0k1l2',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('NEXTAUTH_SECRET', () => {
    it('accepts valid long secret', () => {
      const result = googleOAuthEnvSchema.safeParse(validEnv)
      expect(result.success).toBe(true)
    })

    it('rejects placeholder values', () => {
      const placeholders = [
        'your-secret-key-here',
        'dummy-secret-for-build',
        'changeme',
        'test-secret',
      ]
      for (const placeholder of placeholders) {
        const result = googleOAuthEnvSchema.safeParse({
          ...validEnv,
          NEXTAUTH_SECRET: placeholder,
        })
        expect(result.success).toBe(false)
      }
    })

    it('rejects secrets shorter than 16 characters', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        NEXTAUTH_SECRET: 'short',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('NEXTAUTH_URL', () => {
    it('accepts valid HTTPS URL', () => {
      const result = googleOAuthEnvSchema.safeParse(validEnv)
      expect(result.success).toBe(true)
    })

    it('accepts localhost for development', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        NEXTAUTH_URL: 'http://localhost:3000',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty URL', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        NEXTAUTH_URL: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-URL strings', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        NEXTAUTH_URL: 'not-a-url',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('detects swapped credentials', () => {
    it('catches when client ID and secret are swapped', () => {
      const result = googleOAuthEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_ID: 'GOCSPX-abcdef123456789', // This is a secret, not an ID
        GOOGLE_CLIENT_SECRET: '123456789-abcdef.apps.googleusercontent.com', // This is an ID, not a secret
      })
      // Client ID should fail because it doesn't end with .apps.googleusercontent.com
      expect(result.success).toBe(false)
    })
  })
})

describe('validateOAuthEnv', () => {
  it('returns valid:true for correct env', () => {
    const result = validateOAuthEnv(validEnv)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.data).not.toBeNull()
  })

  it('returns valid:false with error messages for bad env', () => {
    const result = validateOAuthEnv({
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      NEXTAUTH_SECRET: '',
      NEXTAUTH_URL: '',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.data).toBeNull()
  })

  it('trims whitespace from values', () => {
    const result = validateOAuthEnv({
      GOOGLE_CLIENT_ID: '  123456789-abcdef.apps.googleusercontent.com  ',
      GOOGLE_CLIENT_SECRET: '  GOCSPX-abcdef123456789  ',
      NEXTAUTH_SECRET: '  a-very-long-random-secret-string-at-least-32-chars  ',
      NEXTAUTH_URL: '  https://daatan.com  ',
    })
    expect(result.valid).toBe(true)
  })

  it('handles undefined values gracefully', () => {
    const result = validateOAuthEnv({})
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('maskSecret', () => {
  it('masks long secrets showing first 4 and last 4 chars', () => {
    expect(maskSecret('GOCSPX-abcdef123456789')).toBe('GOCS...6789')
  })

  it('masks short values completely', () => {
    expect(maskSecret('short')).toBe('***')
  })

  it('handles undefined', () => {
    expect(maskSecret(undefined)).toBe('***')
  })

  it('handles empty string', () => {
    expect(maskSecret('')).toBe('***')
  })
})

describe('getOAuthDiagnostics', () => {
  it('returns valid diagnostics for correct env', () => {
    const diag = getOAuthDiagnostics(validEnv)
    expect(diag.valid).toBe(true)
    expect(diag.errors).toHaveLength(0)
    expect(diag.diagnostics.GOOGLE_CLIENT_ID.set).toBe(true)
    expect(diag.diagnostics.GOOGLE_CLIENT_ID.format).toBe('valid')
    expect(diag.diagnostics.GOOGLE_CLIENT_SECRET.set).toBe(true)
    expect(diag.diagnostics.NEXTAUTH_SECRET.set).toBe(true)
    expect(diag.diagnostics.NEXTAUTH_URL.value).toBe('https://daatan.com')
  })

  it('does not expose secret values', () => {
    const diag = getOAuthDiagnostics(validEnv)
    const diagString = JSON.stringify(diag)
    // Should not contain the full secret
    expect(diagString).not.toContain('GOCSPX-abcdef123456789')
    expect(diagString).not.toContain('a-very-long-random-secret-string-at-least-32-chars')
  })

  it('reports missing values', () => {
    const diag = getOAuthDiagnostics({})
    expect(diag.valid).toBe(false)
    expect(diag.diagnostics.GOOGLE_CLIENT_ID.set).toBe(false)
    expect(diag.diagnostics.GOOGLE_CLIENT_SECRET.set).toBe(false)
  })
})

describe('.env.example consistency', () => {
  it('env.example lists all required OAuth variables', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const envExample = fs.readFileSync(
      path.resolve(__dirname, '../../.env.example'),
      'utf-8'
    )

    const requiredVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
    ]

    for (const varName of requiredVars) {
      expect(envExample).toContain(varName)
    }
  })

  it('docker-compose.prod.yml passes all required OAuth variables', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const compose = fs.readFileSync(
      path.resolve(__dirname, '../../docker-compose.prod.yml'),
      'utf-8'
    )

    const requiredVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
    ]

    for (const varName of requiredVars) {
      expect(compose).toContain(varName)
    }
  })
})
