import { createLogger } from '@/lib/logger'

const log = createLogger('oracle')

const EXPECTED_API_VERSION = '0.1'

interface OracleForecastResponse {
  question: string
  mean: number
  std: number
  ci_low: number
  ci_high: number
  articles_used: number
  sources: Array<{
    source_id: string
    source_name: string
    url: string
    stance: number
    certainty: number
    credibility_weight: number
    claims: string[]
  }>
  placeholder: boolean
}

interface OracleHealthResponse {
  status: string
  version: string
  leaderboard_sources: number
}

/**
 * Calls the TruthMachine Oracle API to get a calibrated probability estimate
 * for a binary question.
 *
 * Returns a probability in [0, 1], or null if the Oracle is not configured,
 * returned no usable articles, or failed for any reason.
 *
 * Never throws — safe to call fire-and-forget style.
 */
export const getOracleProbability = async (question: string): Promise<number | null> => {
  const url = process.env.ORACLE_URL
  const key = process.env.ORACLE_API_KEY

  if (!url || !key) {
    log.debug('Oracle not configured — skipping')
    return null
  }

  try {
    const res = await fetch(`${url}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ question, max_articles: 3 }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      log.warn({ status: res.status }, 'Oracle returned non-OK status')
      return null
    }

    const data: OracleForecastResponse = await res.json()

    if (data.placeholder) {
      log.debug('Oracle returned placeholder response — no real forecast available')
      return null
    }

    if (typeof data.mean !== 'number' || data.articles_used === 0) {
      log.debug({ articlesUsed: data.articles_used }, 'Oracle returned no usable articles')
      return null
    }

    const probability = (data.mean + 1) / 2
    log.info(
      { question: question.slice(0, 80), probability, articlesUsed: data.articles_used },
      'Oracle probability',
    )
    return probability
  } catch (err) {
    log.warn({ err }, 'Oracle request failed')
    return null
  }
}

/**
 * Check Oracle API health and version compatibility.
 * Returns true if Oracle is reachable and version-compatible.
 * Never throws.
 */
export const checkOracleHealth = async (): Promise<boolean> => {
  const url = process.env.ORACLE_URL
  if (!url) return false

  try {
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return false

    const data: OracleHealthResponse = await res.json()
    if (data.status !== 'ok') return false

    if (data.version && !data.version.startsWith(EXPECTED_API_VERSION)) {
      log.warn(
        { expected: EXPECTED_API_VERSION, actual: data.version },
        'Oracle API version mismatch — falling back to LLM',
      )
      return false
    }

    return true
  } catch {
    return false
  }
}
