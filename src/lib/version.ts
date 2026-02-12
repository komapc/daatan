// Version is read from NEXT_PUBLIC_APP_VERSION which is baked at build time
// from package.json via next.config.js. This ensures server and client always
// agree on the version, preventing hydration mismatches.
// APP_VERSION (runtime env) is only used by the /api/health endpoint for
// server-side reporting — it must NOT be used in any rendered component.
// Bumped to 1.0.15 (Resolving merge conflict + version bump)
export const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.22'
