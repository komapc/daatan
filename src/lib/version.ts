// Format: MAJOR.MINOR.PATCH
// - MAJOR: Breaking changes or major features
// - MINOR: New features, significant improvements
// - PATCH: Bug fixes, small improvements

// Server-side: reads APP_VERSION env var (set in docker-compose)
// Client-side: reads NEXT_PUBLIC_APP_VERSION (baked at build time from package.json via next.config.js)
// Fallback: hardcoded version
export const VERSION = process.env.APP_VERSION || process.env.NEXT_PUBLIC_APP_VERSION || '0.1.19'

