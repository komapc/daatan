/**
 * Next.js instrumentation hook — runs once on server startup.
 * Hard-fails in production if required env vars are missing so misconfigured
 * deploys surface immediately rather than silently degrading at request time.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Sync bot configurations to database on startup (non-blocking)
  import('@/lib/bots/sync').then(({ syncBotsToDatabase }) => {
    syncBotsToDatabase().catch(error => {
      console.error('[startup] Failed to sync bots to database:', error)
    })
  }).catch(err => {
    console.error('[startup] Failed to load bot sync module:', err)
  })

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

  // Validate critical SSM prompt params are not PLACEHOLDER.
  // All of these are called without fallbacks in user-facing request paths;
  // a PLACEHOLDER value causes a runtime error only when the feature is used.
  const criticalPrompts = [
    'express-prediction',
    'extract-prediction',
    'suggest-tags',
    'update-context',
    'dedupe-check',
    'translate',
    'research-query-generation',
    'resolution-research',
    'forecast-quality-validation',
  ] as const

  const rawEnv = process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || 'staging'
  const ssmEnv = rawEnv === 'production' ? 'prod' : rawEnv

  try {
    const { SSMClient, GetParametersCommand } = await import('@aws-sdk/client-ssm')
    const ssm = new SSMClient({ region: process.env.AWS_REGION || 'eu-central-1' })

    const paramNames = criticalPrompts.map((p) => `/daatan/${ssmEnv}/prompts/${p}`)
    const res = await ssm.send(new GetParametersCommand({ Names: paramNames }))

    const placeholders = (res.Parameters ?? [])
      .filter((p) => !p.Value || p.Value === 'PLACEHOLDER')
      .map((p) => p.Name ?? '')

    const missing2 = paramNames.filter(
      (name) => placeholders.includes(name) || !(res.Parameters ?? []).find((p) => p.Name === name),
    )

    if (missing2.length > 0) {
      // Warn only — hardcoded fallback prompts in bedrock-prompts.ts cover all PLACEHOLDER params
      // eslint-disable-next-line no-console
      console.warn(
        `[startup] SSM params using hardcoded fallbacks (Bedrock not fully configured):\n` +
        missing2.map((n) => `  - ${n}`).join('\n') +
        '\nRun ./scripts/promote-prompt.sh to promote real Bedrock ARNs.',
      )
    } else {
      // eslint-disable-next-line no-console
      console.log(`[startup] SSM prompt params OK (${ssmEnv}, ${criticalPrompts.length} checked)`)
    }
  } catch (error) {
    // SSM unreachable — log and continue
    // eslint-disable-next-line no-console
    console.warn('[startup] Could not validate SSM prompt params:', error)
  }
}
