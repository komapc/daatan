import { env } from '@/env'

// Version is read from NEXT_PUBLIC_APP_VERSION which is baked at build time
// from package.json via next.config.js. This ensures server and client always
// agree on the version, preventing hydration mismatches.
// APP_VERSION (runtime env) is only used by the /api/health endpoint for
// server-side reporting.
export const VERSION = env.NEXT_PUBLIC_APP_VERSION || 'unknown' // v1.6.21
