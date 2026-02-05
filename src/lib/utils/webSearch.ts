// Web search utility for finding relevant articles using Google Custom Search API

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source?: string
  publishedDate?: string
}

interface GoogleSearchItem {
  title: string
  link: string
  snippet: string
  displayLink?: string
  pagemap?: {
    metatags?: Array<{
      'article:published_time'?: string
      'og:site_name'?: string
    }>
  }
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[]
}

export async function searchArticles(query: string, limit: number = 5): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID

  if (!apiKey || !searchEngineId) {
    console.error('Google Custom Search API not configured')
    throw new Error('Search API not configured')
  }

  try {
    // Add "news" to query to prioritize recent articles
    const searchQuery = `${query} news`
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&num=${limit}&sort=date`

    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`)
    }

    const data: GoogleSearchResponse = await response.json()

    if (!data.items || data.items.length === 0) {
      return []
    }

    return data.items.map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: item.displayLink || extractDomain(item.link),
      publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time'] || undefined
    }))
  } catch (error) {
    console.error('Search error:', error)
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

export async function fetchArticleContent(url: string): Promise<string> {
  // Note: Article content fetching requires additional service/scraper
  // For now, we rely on snippets from search results
  console.warn('Article content fetching not implemented - using snippets')
  return ''
}
