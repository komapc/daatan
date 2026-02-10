// Web search utility for finding relevant articles using Serper.dev API

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
    console.error('Serper API not configured')
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
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DaatanBot/1.0; +http://daatan.ai)'
      }
    })

    if (!response.ok) {
      console.warn(`Failed to fetch article: ${response.status}`)
      return ''
    }

    const html = await response.text()

    // valid simple strategies to extract text:
    // 1. remove scripts and styles
    const noScripts = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")

    // 2. remove tags
    const text = noScripts.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    // Limit to ~5000 chars to avoid token limits
    return text.substring(0, 5000)
  } catch (error) {
    console.warn('Error fetching article content:', error)
    return ''
  }
}
