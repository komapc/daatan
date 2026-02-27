/**
 * Next.js instrumentation hook — runs once on server startup.
 * Hard-fails in production if required env vars are missing so misconfigured
 * deploys surface immediately rather than silently degrading at request time.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return

  const required: Array<{ key: string; feature: string }> = [
    { key: 'GEMINI_API_KEY', feature: 'LLM / bot-runner' },
    { key: 'SERPER_API_KEY', feature: 'web search / research' },
    { key: 'VAPID_PRIVATE_KEY', feature: 'browser push notifications' },
    { key: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', feature: 'browser push notifications' },
  ]

  const missing = required.filter(({ key }) => !process.env[key])

  if (missing.length > 0) {
    const lines = missing.map(({ key, feature }) => `  - ${key}  (required for ${feature})`).join('\n')
    // eslint-disable-next-line no-console
    console.error(
      `[startup] FATAL: Missing required environment variables:\n${lines}\n` +
      'Set them in your deployment environment and restart the server.',
    )
    // Throw to prevent the server from starting in a broken state
    throw new Error(`Missing required env vars: ${missing.map((m) => m.key).join(', ')}`)
  }
}
