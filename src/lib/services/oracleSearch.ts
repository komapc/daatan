import { env } from '@/env'
import { createLogger } from '@/lib/logger'
import { notifyOracleSearchUnavailable } from '@/lib/services/telegram'
import type { SearchResult } from '@/lib/utils/webSearch'

const log = createLogger('oracle-search')

const SEARCH_TIMEOUT_MS = 10_000

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
}

/** Strip a single trailing slash so `${baseUrl}/path` never gets a double slash. */
const normalizeBaseUrl = (url: string) => url.replace(/\/$/, '')

/**
 * Search via the Oracle's /search endpoint, sharing the oracle's provider
 * fallback chain and quota counter with the oracle's own forecast calls.
 *
 * Returns null if:
 * - ORACLE_URL or ORACLE_API_KEY are not configured
 * - The request times out, returns a non-OK status, or throws
 * - The response contains zero results
 *
 * Never throws — safe to use as a drop-in try-first before searchArticles().
 */
export async function oracleSearch(
  query: string,
  limit: number = 5,
  options?: { dateFrom?: Date; dateTo?: Date },
): Promise<SearchResult[] | null> {
  const baseUrl = env.ORACLE_URL
  const key = env.ORACLE_API_KEY

  if (!baseUrl || !key) return null

  const body: Record<string, unknown> = { query, limit }
  if (options?.dateFrom) body.date_from = options.dateFrom.toISOString().slice(0, 10)
  if (options?.dateTo) body.date_to = options.dateTo.toISOString().slice(0, 10)

  try {
    const res = await fetch(`${normalizeBaseUrl(baseUrl)}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    })

    if (!res.ok) {
      log.warn({ status: res.status, query }, 'oracle-search: non-OK response')
      notifyOracleSearchUnavailable(query)
      return null
    }

    const data: OracleSearchResponse = await res.json()

    if (!data.results || data.results.length === 0) {
      log.debug({ query }, 'oracle-search: empty results')
      return null
    }

    log.info({ query, count: data.count }, 'oracle-search: success')

    return data.results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      source: r.source || undefined,
      publishedDate: r.published_date || undefined,
    }))
  } catch (err) {
    log.warn({ err, query }, 'oracle-search: request failed')
    notifyOracleSearchUnavailable(query)
    return null
  }
}
