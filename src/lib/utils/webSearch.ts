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

export async function searchArticles(query: string, limit: number = 5): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY

  if (!apiKey) {
    log.error('Serper API not configured')
    throw new Error('Search API not configured')
  }

  try {
    // Add "news" to query to prioritize recent articles
    const searchQuery = `${query} news`

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: searchQuery,
        num: limit
      })
    })

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`)
    }

    const data: SerperResponse = await response.json()

    // Prefer news results if available, otherwise use organic results
    const results = data.news || data.organic || []

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

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname
    return domain.replace('www.', '')
  } catch {
    return 'Unknown'
  }
}
