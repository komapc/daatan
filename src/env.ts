import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    // Database
    DATABASE_URL: z.string().url(),

    // NextAuth.js
    NEXTAUTH_URL: z.string().url(),
    NEXTAUTH_SECRET: z
      .string()
      .min(32, 'Must be at least 32 characters long')
      .refine(
        (val) => !['changeme', 'placeholder', 'dummy', 'development', 'example', 'your-secret', 'test-secret'].some((s) => val.toLowerCase().includes(s)),
        'Contains placeholder text - use a real secret'
      )
      .refine(
        (val) => /[^a-zA-Z\s-]/.test(val),
        'Looks like plain text - must contain numbers or special characters'
      ),

    // Google OAuth
    GOOGLE_CLIENT_ID: z
      .string()
      .regex(/\.apps\.googleusercontent\.com$/, 'Must end with .apps.googleusercontent.com'),
    GOOGLE_CLIENT_SECRET: z
      .string()
      .min(10, 'Too short to be valid'),

    // Optional / Other
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    NEXTAUTH_DEBUG: z.enum(['true', 'false']).optional(),
    
    // AI / Analytics
    GEMINI_API_KEY: z.string().min(1).optional(),
    SERPER_API_KEY: z.string().min(1).optional(),
    GA_MEASUREMENT_ID: z.string().startsWith('G-').optional(),

    // Telegram notifications
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_CHAT_ID: z.string().min(1).optional(),

    // Web Push (VAPID)
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_VERSION: z.string().optional(),
    NEXT_PUBLIC_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  },
  // If you're using Next.js < 13.4.4, you'll need to specify the runtimeEnv manually
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_DEBUG: process.env.NEXTAUTH_DEBUG,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    SERPER_API_KEY: process.env.SERPER_API_KEY,
    GA_MEASUREMENT_ID: process.env.GA_MEASUREMENT_ID,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
  // validation logic
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
