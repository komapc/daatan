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
// Provider: ScrapingBee Google Search
// ──────────────────────────────────────────────

interface ScrapingBeeResult {
  url: string
  title: string
  description: string
  domain?: string
  date?: string | null
  date_utc?: string | null
}

interface ScrapingBeeResponse {
  organic_results?: ScrapingBeeResult[]
  news_results?: ScrapingBeeResult[]
  top_stories?: ScrapingBeeResult[]
}

async function searchWithScrapingBee(query: string, limit: number): Promise<SearchResult[]> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY
  if (!apiKey) throw new Error('ScrapingBee not configured')

  const url = new URL('https://app.scrapingbee.com/api/v1/store/google')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('search', query)
  url.searchParams.set('nb_results', String(limit))

  const response = await fetch(url.toString())

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '(no body)')
    log.error({ status: response.status, body: errorBody }, 'ScrapingBee API error')
    throw new Error(`ScrapingBee error: ${response.status}`)
  }

  const data: ScrapingBeeResponse = await response.json()
  const results = (data.news_results?.length ? data.news_results : null)
    ?? (data.top_stories?.length ? data.top_stories : null)
    ?? data.organic_results
    ?? []

  return results.slice(0, limit).map(item => ({
    title: item.title,
    url: item.url,
    snippet: item.description,
    source: item.domain || extractDomain(item.url),
    publishedDate: item.date_utc || item.date || undefined,
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

  // DDG Lite: <a href="URL" class='result-link'>Title</a> (class on the <a> itself)
  // Match the whole <a> tag first, then extract href and inner text
  const linkTagRegex = /<a\b[^>]*\bclass=['"]result-link['"][^>]*>([^<]+)<\/a>/g
  const hrefRegex = /\bhref=['"]([^'"]+)['"]/
  // Snippets: <td class='result-snippet'>...</td>
  const snippetRegex = /class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g

  const links: { url: string; title: string }[] = []
  let m: RegExpExecArray | null
  while ((m = linkTagRegex.exec(html)) !== null) {
    const hrefMatch = hrefRegex.exec(m[0])
    if (hrefMatch) {
      links.push({ url: hrefMatch[1], title: m[1].trim() })
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
      if (results.length > 0) {
        log.debug({ provider: 'serper', count: results.length }, 'Search succeeded')
        return results
      }
      log.warn('Serper returned 0 results, trying SerpAPI fallback')
    } catch (error) {
      log.warn({ err: error }, 'Serper failed, trying SerpAPI fallback')
    }
  }

  // 2. SerpAPI
  if (process.env.SERPAPI_API_KEY) {
    try {
      const results = await searchWithSerpApi(query, limit)
      if (results.length > 0) {
        log.info({ provider: 'serpapi', count: results.length }, 'Search succeeded via SerpAPI fallback')
        return results
      }
      log.warn('SerpAPI returned 0 results, trying ScrapingBee fallback')
    } catch (error) {
      log.warn({ err: error }, 'SerpAPI failed, trying ScrapingBee fallback')
    }
  }

  // 3. ScrapingBee
  if (process.env.SCRAPINGBEE_API_KEY) {
    try {
      const results = await searchWithScrapingBee(query, limit)
      if (results.length > 0) {
        log.info({ provider: 'scrapingbee', count: results.length }, 'Search succeeded via ScrapingBee fallback')
        return results
      }
      log.warn('ScrapingBee returned 0 results, trying DDG fallback')
    } catch (error) {
      log.warn({ err: error }, 'ScrapingBee failed, trying DDG fallback')
    }
  }

  // 4. DuckDuckGo (free, no key)
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
