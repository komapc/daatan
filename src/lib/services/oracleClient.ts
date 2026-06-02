import { env } from '@/env'

export interface OracleConfig {
  baseUrl: string
  key: string
}

/** Strip a single trailing slash so `${baseUrl}${path}` never doubles up. */
const stripTrailingSlash = (url: string): string => url.replace(/\/$/, '')

/**
 * Normalized Oracle base URL when `ORACLE_URL` is set; `null` otherwise.
 * No API key required — for the unauthenticated endpoints (`/health`,
 * `/fetch-url`).
 */
export function getOracleBaseUrl(): string | null {
  return env.ORACLE_URL ? stripTrailingSlash(env.ORACLE_URL) : null
}

/**
 * Normalized base URL + API key, or `null` when either is missing. Use for the
 * authenticated endpoints; pass the result to {@link oracleFetch}.
 */
export function getOracleConfig(): OracleConfig | null {
  const url = env.ORACLE_URL
  const key = env.ORACLE_API_KEY
  if (!url || !key) return null
  return { baseUrl: stripTrailingSlash(url), key }
}

/**
 * `fetch()` against an authenticated Oracle endpoint: applies the `x-api-key`
 * header and an abort timeout. Callers own the response handling — services
 * fail open (return `null`), proxy routes pass the status through.
 */
export function oracleFetch(
  cfg: OracleConfig,
  path: string,
  init: RequestInit & { timeoutMs: number },
): Promise<Response> {
  const { timeoutMs, headers, ...rest } = init
  return fetch(`${cfg.baseUrl}${path}`, {
    ...rest,
    headers: { 'x-api-key': cfg.key, ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  })
}
