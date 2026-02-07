// Version is read from environment variable at runtime for zero-downtime updates
// Format: MAJOR.MINOR.PATCH
// - MAJOR: Breaking changes or major features
// - MINOR: New features, significant improvements
// - PATCH: Bug fixes, small improvements, every PR

// Fallback to build-time version if env var not set
export const VERSION = process.env.APP_VERSION || '0.1.37'

