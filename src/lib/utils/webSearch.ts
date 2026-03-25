// Web search utility with fallback chain: Serper → SerpAPI → DuckDuckGo

import { createLogger } from '@/lib/logger'

const log = createLogger('web-search')

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source?: string
  publishedDate?: string
}

// ──────────────────────────────────────────────
// Provider: Serper.dev
// ──────────────────────────────────────────────

interface SerperNewsItem {
  title: string
  link: string
  snippet: string
  date?: string
}

interface SerperResponse {
  organic?: SerperNewsItem[]
  news?: SerperNewsItem[]
}

async function searchWithSerper(
  query: string,
  limit: number,
  options?: { dateFrom?: Date; dateTo?: Date },
): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) throw new Error('Serper not configured')

  const body: Record<string, unknown> = { q: query, num: limit }
  if (options?.dateFrom && options?.dateTo) {
    body.tbs = `cdr:1,cd_min:${formatSerperDate(options.dateFrom)},cd_max:${formatSerperDate(options.dateTo)}`
  }

  const response = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '(no body)')
    log.error({ status: response.status, body: errorBody }, 'Serper API error')
    throw new Error(`Search API error: ${response.status}`)
  }

  const data: SerperResponse = await response.json()
  const news = data.news ?? []
  const results = news.length > 0 ? news : (data.organic ?? [])

  return results.slice(0, limit).map(item => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet,
    source: extractDomain(item.link),
    publishedDate: item.date || undefined,
  }))
}

function formatSerperDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

// ──────────────────────────────────────────────
// Provider: SerpAPI
// ──────────────────────────────────────────────

interface SerpApiNewsItem {
  title: string
  link: string
  snippet: string
  date?: string
  source?: { name?: string }
}

interface SerpApiResponse {
  news_results?: SerpApiNewsItem[]
}

async function searchWithSerpApi(query: string, limit: number): Promise<SearchResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) throw new Error('SerpAPI not configured')

  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('q', query)
  url.searchParams.set('tbm', 'nws')
  url.searchParams.set('num', String(limit))
  url.searchParams.set('api_key', apiKey)

  const response = await fetch(url.toString())

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '(no body)')
    log.error({ status: response.status, body: errorBody }, 'SerpAPI error')
    throw new Error(`SerpAPI error: ${response.status}`)
  }

  const data: SerpApiResponse = await response.json()
  const results = data.news_results ?? []

  return results.slice(0, limit).map(item => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet,
    source: item.source?.name || extractDomain(item.link),
    publishedDate: item.date || undefined,
  }))
}

// ──────────────────────────────────────────────
// Provider: DuckDuckGo (no API key, last resort)
// ──────────────────────────────────────────────

async function searchWithDDG(query: string, limit: number): Promise<SearchResult[]> {
  const body = new URLSearchParams({ q: query, kl: 'us-en' })
  const response = await fetch('https://lite.duckduckgo.com/lite/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (compatible; DaatanApp/1.0)',
    },
    body: body.toString(),
  })

  if (!response.ok) throw new Error(`DDG error: ${response.status}`)

  const html = await response.text()
  const results: SearchResult[] = []

  // Extract title + redirect URL from result-link cells
  const linkRegex = /class="result-link"[^>]*>\s*<a[^>]+href="[^"]*uddg=([^"&]+)[^"]*"[^>]*>([^<]+)<\/a>/g
  // Extract snippets from result-snippet cells
  const snippetRegex = /class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g

  const links: { url: string; title: string }[] = []
  let m: RegExpExecArray | null
  while ((m = linkRegex.exec(html)) !== null) {
    try {
      links.push({ url: decodeURIComponent(m[1]), title: m[2].trim() })
    } catch {
      // skip malformed URL
    }
  }

  const snippets: string[] = []
  while ((m = snippetRegex.exec(html)) !== null) {
    snippets.push(m[1].replace(/<[^>]+>/g, '').trim())
  }

  const count = Math.min(links.length, limit)
  for (let i = 0; i < count; i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
      source: extractDomain(links[i].url),
    })
  }

  return results
}

// ──────────────────────────────────────────────
// Public API: tries providers in order
// ──────────────────────────────────────────────

export async function searchArticles(
  query: string,
  limit: number = 10,
  options?: { dateFrom?: Date; dateTo?: Date },
): Promise<SearchResult[]> {
  // 1. Serper
  if (process.env.SERPER_API_KEY) {
    try {
      const results = await searchWithSerper(query, limit, options)
      log.debug({ provider: 'serper', count: results.length }, 'Search succeeded')
      return results
    } catch (error) {
      log.warn({ err: error }, 'Serper failed, trying SerpAPI fallback')
    }
  }

  // 2. SerpAPI
  if (process.env.SERPAPI_API_KEY) {
    try {
      const results = await searchWithSerpApi(query, limit)
      log.info({ provider: 'serpapi', count: results.length }, 'Search succeeded via SerpAPI fallback')
      return results
    } catch (error) {
      log.warn({ err: error }, 'SerpAPI failed, trying DDG fallback')
    }
  }

  // 3. DuckDuckGo (free, no key)
  try {
    const results = await searchWithDDG(query, limit)
    log.info({ provider: 'ddg', count: results.length }, 'Search succeeded via DDG fallback')
    return results
  } catch (error) {
    log.error({ err: error }, 'All search providers failed')
    // Dynamically import to avoid circular dep at module load time
    import('@/lib/services/telegram').then(({ notifyAllSearchProvidersFailed }) => {
      notifyAllSearchProvidersFailed(query)
    }).catch(() => {})
    throw new Error('Search API not available')
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname
    return domain.replace('www.', '')
  } catch {
    return 'Unknown'
  }
}
