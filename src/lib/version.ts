import { env } from '@/env'

// Version is read from NEXT_PUBLIC_APP_VERSION which is baked at build time
// by the CI/CD pipeline. This ensures that the client and server always
// agree on the version, preventing hydration mismatches.
// APP_VERSION (runtime env) is only used by the /api/health endpoint for
export const VERSION = env.NEXT_PUBLIC_APP_VERSION || 'unknown' // v1.6.25
