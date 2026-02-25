// Web search utility for finding relevant articles using Serper.dev API

import { createLogger } from '@/lib/logger'

const log = createLogger('web-search')

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source?: string
  publishedDate?: string
}

interface SerperSearchResult {
  title: string
  link: string
  snippet: string
  position: number
  date?: string
}

interface SerperResponse {
  organic?: SerperSearchResult[]
  news?: SerperSearchResult[]
}

export async function searchArticles(
  query: string,
  limit: number = 10,
  options?: { dateFrom?: Date; dateTo?: Date }
): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY

  if (!apiKey) {
    log.error('Serper API not configured')
    throw new Error('Search API not configured')
  }

  try {
    const body: Record<string, unknown> = { q: query, num: limit }

    if (options?.dateFrom && options?.dateTo) {
      body.tbs = `cdr:1,cd_min:${formatSerperDate(options.dateFrom)},cd_max:${formatSerperDate(options.dateTo)}`
    }

    const response = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`)
    }

    const data: SerperResponse = await response.json()
    // Prefer news results; fall back to organic only when news is absent or empty
    const news = data.news ?? []
    const results = news.length > 0 ? news : (data.organic ?? [])

    if (results.length === 0) {
      return []
    }

    return results.slice(0, limit).map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: extractDomain(item.link),
      publishedDate: item.date || undefined
    }))
  } catch (error) {
    log.error({ err: error }, 'Search error')
    throw error
  }
}

function formatSerperDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname
    return domain.replace('www.', '')
  } catch {
    return 'Unknown'
  }
}
