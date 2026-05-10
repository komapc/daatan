// Web search utility with fallback chain: DataForSEO → Serper → BrightData → Nimbleway → SerpAPI → ScrapingBee → DuckDuckGo
// Provider order is determined by which env vars are set; provider functions stay
// in place so any one can be re-enabled by populating its key in Secrets Manager.

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
  link?: string  // can be absent on some result types (knowledge panels, featured snippets)
  url?: string   // alternate field name seen on organic/topStories items
  snippet: string
  date?: string
}

interface SerperResponse {
  organic?: SerperNewsItem[]
  news?: SerperNewsItem[]
  topStories?: SerperNewsItem[]  // returned by /news when no standard news results exist
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
  const results = news.length > 0
    ? news
    : (data.topStories?.length ? data.topStories : (data.organic ?? []))

  return results
    .map(item => ({ ...item, resolvedLink: item.link || item.url }))
    .filter(item => item.resolvedLink)
    .slice(0, limit)
    .map(item => ({
      title: item.title,
      url: item.resolvedLink!,
      snippet: item.snippet,
      source: extractDomain(item.resolvedLink!),
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

  return results
    .filter(item => item.link)
    .slice(0, limit)
    .map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: item.source?.name || extractDomain(item.link),
      publishedDate: item.date || undefined,
    }))
}

// ──────────────────────────────────────────────
// Provider: DataForSEO Google News API
// ──────────────────────────────────────────────

interface DataForSEONewsItem {
  title: string
  url: string
  snippet: string
  domain?: string
  date?: string
}

interface DataForSEOResponse {
  tasks?: Array<{
    result?: Array<{
      items?: DataForSEONewsItem[]
    }>
  }>
}

async function searchWithDataForSEO(query: string, limit: number): Promise<SearchResult[]> {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) throw new Error('DataForSEO not configured')

  const credentials = Buffer.from(`${login}:${password}`).toString('base64')

  const response = await fetch('https://api.dataforseo.com/v3/serp/google/news/live/advanced', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{
      keyword: query,
      depth: limit,
    }]),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '(no body)')
    log.error({ status: response.status, body: errorBody }, 'DataForSEO API error')
    throw new Error(`DataForSEO error: ${response.status}`)
  }

  const data: DataForSEOResponse = await response.json()
  const items = data.tasks?.[0]?.result?.[0]?.items ?? []

  return items.slice(0, limit).map(item => ({
    title: item.title,
    url: item.url,
    snippet: item.snippet,
    source: item.domain || extractDomain(item.url),
    publishedDate: item.date || undefined,
  }))
}

// ──────────────────────────────────────────────
// Provider: BrightData Web Access SERP API
// ──────────────────────────────────────────────

async function searchWithBrightData(query: string, limit: number): Promise<SearchResult[]> {
  const apiKey = process.env.BRIGHTDATA_API_KEY
  if (!apiKey) throw new Error('BrightData not configured')

  const url = new URL('https://www.google.com/search')
  url.searchParams.set('q', query)

  const response = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ zone: 'serp_api1', url: url.toString(), format: 'raw' }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '(no body)')
    log.error({ status: response.status, body: errorBody }, 'BrightData API error')
    throw new Error(`BrightData error: ${response.status}`)
  }

  const html = await response.text()

  // Extract title+URL pairs: <a href="URL"><h3 class="LC20lb ...">Title</h3>
  const resultPattern = /href="(https:\/\/[^"#]+)"[^>]*>[^<]*<h3[^>]*class="LC20lb[^>]*>([^<]+)<\/h3>/g
  // Extract snippets: <div class="VwiC3b ...">snippet</div>
  const snippetPattern = /class="VwiC3b[^"]*"[^>]*>(.*?)<\/div>/g

  const pairs: { url: string; title: string }[] = []
  let m: RegExpExecArray | null
  while ((m = resultPattern.exec(html)) !== null) {
    pairs.push({ url: m[1], title: m[2] })
  }

  const snippets: string[] = []
  while ((m = snippetPattern.exec(html)) !== null) {
    const clean = m[1].replace(/<[^>]+>/g, '').trim()
    if (clean) snippets.push(clean)
  }

  return pairs.slice(0, limit).map((pair, i) => ({
    title: pair.title,
    url: pair.url,
    snippet: snippets[i] || '',
    source: extractDomain(pair.url),
  }))
}

// ──────────────────────────────────────────────
// Provider: Nimbleway SERP API
// ──────────────────────────────────────────────

interface NimblewayOrganicResult {
  title: string
  url: string
  snippet: string
  cleaned_domain?: string
}

interface NimblewayResponse {
  status: string
  parsing?: {
    entities?: {
      OrganicResult?: NimblewayOrganicResult[]
    }
  }
}

async function searchWithNimbleway(query: string, limit: number): Promise<SearchResult[]> {
  const apiKey = process.env.NIMBLEWAY_API_KEY
  if (!apiKey) throw new Error('Nimbleway not configured')

  const response = await fetch('https://api.webit.live/api/v1/realtime/serp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      search_engine: 'google_search',
      query,
      parse: true,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '(no body)')
    log.error({ status: response.status, body: errorBody }, 'Nimbleway API error')
    throw new Error(`Nimbleway error: ${response.status}`)
  }

  const data: NimblewayResponse = await response.json()
  if (data.status !== 'success') {
    throw new Error(`Nimbleway error: ${data.status}`)
  }

  const results = data.parsing?.entities?.OrganicResult ?? []
  return results.slice(0, limit).map(item => ({
    title: item.title,
    url: item.url,
    snippet: item.snippet,
    source: item.cleaned_domain || extractDomain(item.url),
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
  const body = new URLSearchParams({ q: query })
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
  limit: number = 30,
  options?: { dateFrom?: Date; dateTo?: Date },
): Promise<SearchResult[]> {
  // 1. DataForSEO (primary)
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    try {
      const results = await searchWithDataForSEO(query, limit)
      if (results.length > 0) {
        log.debug({ provider: 'dataforseo', count: results.length }, 'Search succeeded')
        return results
      }
      log.warn('DataForSEO returned 0 results, trying Serper fallback')
    } catch (error) {
      log.warn({ err: error }, 'DataForSEO failed, trying Serper fallback')
    }
  }

  // 2. Serper
  if (process.env.SERPER_API_KEY) {
    try {
      const results = await searchWithSerper(query, limit, options)
      if (results.length > 0) {
        log.debug({ provider: 'serper', count: results.length }, 'Search succeeded')
        return results
      }
      log.warn('Serper returned 0 results, trying BrightData fallback')
    } catch (error) {
      log.warn({ err: error }, 'Serper failed, trying BrightData fallback')
    }
  }

  // 3. BrightData
  if (process.env.BRIGHTDATA_API_KEY) {
    try {
      const results = await searchWithBrightData(query, limit)
      if (results.length > 0) {
        log.debug({ provider: 'brightdata', count: results.length }, 'Search succeeded')
        return results
      }
      log.warn('BrightData returned 0 results, trying Nimbleway fallback')
    } catch (error) {
      log.warn({ err: error }, 'BrightData failed, trying Nimbleway fallback')
    }
  }

  // 4. Nimbleway
  if (process.env.NIMBLEWAY_API_KEY) {
    try {
      const results = await searchWithNimbleway(query, limit)
      if (results.length > 0) {
        log.info({ provider: 'nimbleway', count: results.length }, 'Search succeeded via Nimbleway fallback')
        return results
      }
      log.warn('Nimbleway returned 0 results, trying SerpAPI fallback')
    } catch (error) {
      log.warn({ err: error }, 'Nimbleway failed, trying SerpAPI fallback')
    }
  }

  // 5. SerpAPI
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

  // 6. ScrapingBee
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

  // 7. DuckDuckGo (free, no key)
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
