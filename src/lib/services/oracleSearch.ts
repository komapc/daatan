import { createLogger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { notifyOracleSearchUnavailable } from '@/lib/services/telegram'
import { getOracleConfig, oracleFetch } from '@/lib/services/oracleClient'

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source?: string
  publishedDate?: string
}

const log = createLogger('oracle-search')

const SEARCH_TIMEOUT_MS = 25_000
const HEALTH_TIMEOUT_MS = 5_000

/** Alert threshold shared between the health UI route and the hourly cron. */
export const SEARCH_LOW_CREDITS_THRESHOLD = 100

export interface OracleSearchProviderStatus {
  configured: boolean
  exhausted: boolean
  status: 'ok' | 'error' | 'not_configured' | string
  credits?: number
  error?: string
}

export interface OracleSearchHealthResponse {
  providers: Record<string, OracleSearchProviderStatus>
  overall: 'healthy' | 'degraded' | 'unhealthy' | string
  usable_count: number
}

/**
 * Fetch provider health from the Oracle's /search/health endpoint.
 * Returns null if oracle is not configured or the request fails.
 * Never throws.
 */
export async function getOracleSearchHealth(): Promise<OracleSearchHealthResponse | null> {
  const cfg = getOracleConfig()
  if (!cfg) return null

  try {
    const res = await oracleFetch(cfg, '/search/health', { timeoutMs: HEALTH_TIMEOUT_MS })
    if (!res.ok) {
      log.warn({ status: res.status }, 'oracle-search-health: non-OK response')
      return null
    }
    return await res.json() as OracleSearchHealthResponse
  } catch (err) {
    log.warn({ err }, 'oracle-search-health: request failed')
    return null
  }
}

interface OracleSearchResult {
  title: string
  url: string
  snippet: string
  source: string
  published_date: string
}

interface OracleSearchResponse {
  query: string
  results: OracleSearchResult[]
  count: number
  /** Provider that served this request (e.g. "dataforseo", "gdelt", "ddg"). "none" means no named provider claimed the result. */
  provider: string
  /** Ordered list of providers attempted before the successful one. */
  provider_chain: string[]
}

/**
 * Search via the Oracle's /search endpoint, sharing the oracle's provider
 * fallback chain and quota counter with the oracle's own forecast calls.
 *
 * Returns null if:
 * - ORACLE_URL or ORACLE_API_KEY are not configured
 * - The request times out, returns a non-OK status, or throws
 * - The response contains zero results
 *
 * Never throws.
 */
export async function oracleSearch(
  query: string,
  limit: number = 20, // default for ad-hoc calls; use DEFAULT_MAX_ARTICLES for consistent budgets
  options?: { dateFrom?: Date; dateTo?: Date },
): Promise<SearchResult[] | null> {
  const cfg = getOracleConfig()
  if (!cfg) return null

  const body: Record<string, unknown> = { query, limit }
  if (options?.dateFrom) body.date_from = options.dateFrom.toISOString().slice(0, 10)
  if (options?.dateTo) body.date_to = options.dateTo.toISOString().slice(0, 10)

  const t0 = Date.now()
  try {
    const res = await oracleFetch(cfg, '/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: SEARCH_TIMEOUT_MS,
    })

    if (!res.ok) {
      const errorBody = await res.text().catch(() => '(unreadable)')
      log.warn({ status: res.status, body: errorBody, query, durationMs: Date.now() - t0 }, 'oracle-search: non-OK response')
      notifyOracleSearchUnavailable(query)
      return null
    }

    const data: OracleSearchResponse = await res.json()

    if (!data.results || data.results.length === 0) {
      log.debug({ query }, 'oracle-search: empty results')
      return null
    }

    const durationMs = Date.now() - t0
    log.info({ query, count: data.count, provider: data.provider, providerChain: data.provider_chain, durationMs }, 'oracle-search: success')

    void writeCallLog(query, data.provider, data.provider_chain, data.results.length, durationMs)

    return data.results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      source: r.source || undefined,
      publishedDate: r.published_date || undefined,
    }))
  } catch (err) {
    log.warn({ err, query, durationMs: Date.now() - t0 }, 'oracle-search: request failed')
    notifyOracleSearchUnavailable(query)
    return null
  }
}

const PRUNE_DAYS = 30

async function writeCallLog(
  query: string,
  provider: string,
  providerChain: string[],
  resultCount: number,
  durationMs: number,
): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - PRUNE_DAYS * 24 * 60 * 60 * 1000)
    await prisma.$transaction([
      prisma.oracleCallLog.create({
        data: { provider, providerChain, query, resultCount, durationMs },
      }),
      prisma.oracleCallLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    ])
  } catch (err) {
    log.warn({ err }, 'oracle-search: failed to write call log')
  }
}
