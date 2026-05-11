import { env } from '@/env'
import { createLogger } from '@/lib/logger'

const log = createLogger('oracle')

const EXPECTED_API_VERSION = '0.1'
const FORECAST_TIMEOUT_MS = 12_000
const HEALTH_TIMEOUT_MS = 5_000
export const DEFAULT_MAX_ARTICLES = 30

export interface ArticleInput {
  url: string
  title: string
  snippet: string
  source?: string
  publishedDate?: string
}

/** Per-source signal returned by the Oracle's /forecast endpoint. */
export interface OracleSource {
  source_id: string
  source_name: string
  url: string
  /** Stance in [-1, 1]: positive = supports YES, negative = supports NO. */
  stance: number
  /** Certainty in [0, 1]: how confident this source is. */
  certainty: number
  /** Credibility weight from the leaderboard; 1.0 = neutral. */
  credibility_weight: number
  claims: string[]
}

/** Full response from POST /forecast. */
export interface OracleForecastResponse {
  question: string
  /** Aggregated stance in [-1, 1]. Map to [0, 1] probability via (mean+1)/2. */
  mean: number
  std: number
  ci_low: number
  ci_high: number
  articles_used: number
  sources: OracleSource[]
  /** True if the Oracle couldn't produce a real forecast (stub response). */
  placeholder: boolean
}

interface OracleHealthResponse {
  status: string
  version?: string
  leaderboard_sources?: number
}

/** Strip a single trailing slash so `${baseUrl}/path` doesn't produce a double slash. */
const normalizeBaseUrl = (url: string): string => url.replace(/\/$/, '')

/**
 * Call the TruthMachine Oracle API and return the full forecast payload.
 *
 * Returns `null` if the Oracle is not configured, returned a placeholder
 * response, had no usable articles, or failed for any reason (timeout,
 * non-OK status, network error). Never throws — safe to call
 * fire-and-forget style.
 */
export const getOracleForecast = async (
  question: string,
  options?: { articles?: ArticleInput[] },
): Promise<OracleForecastResponse | null> => {
  const url = env.ORACLE_URL
  const key = env.ORACLE_API_KEY

  if (!url || !key) {
    log.debug('Oracle not configured — skipping')
    return null
  }

  try {
    const res = await fetch(`${normalizeBaseUrl(url)}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({
        question,
        max_articles: DEFAULT_MAX_ARTICLES,
        ...(options?.articles?.length ? { articles: options.articles } : {}),
      }),
      signal: AbortSignal.timeout(FORECAST_TIMEOUT_MS),
    })

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '(unreadable)')
      log.warn({ status: res.status, body: errorBody }, 'Oracle returned non-OK status')
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

    log.info(
      {
        question: question.slice(0, 80),
        mean: data.mean,
        articlesUsed: data.articles_used,
        sources: data.sources.length,
      },
      'Oracle forecast',
    )
    return data
  } catch (err) {
    log.warn({ err }, 'Oracle request failed')
    return null
  }
}

/**
 * Thin back-compat wrapper: returns just the scaled probability in [0, 1],
 * or null if the Oracle path wasn't usable. Prefer `getOracleForecast` when
 * you also want the sources or confidence interval.
 */
export const getOracleProbability = async (question: string): Promise<number | null> => {
  const data = await getOracleForecast(question)
  if (!data) return null
  return (data.mean + 1) / 2
}

/**
 * Check Oracle API health and version compatibility.
 * Returns true if Oracle is reachable and version-compatible.
 * Never throws.
 */
export const checkOracleHealth = async (): Promise<boolean> => {
  const url = env.ORACLE_URL
  if (!url) return false

  try {
    const res = await fetch(`${normalizeBaseUrl(url)}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
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
