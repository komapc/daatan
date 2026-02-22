import Parser from 'rss-parser'
import { createLogger } from '@/lib/logger'

const log = createLogger('rss')

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'Daatan-Bot/1.0' },
})

export interface RssItem {
  title: string
  url: string
  source: string       // Feed name/domain
  publishedAt: Date
  snippet?: string
}

/**
 * Fetches items from a list of RSS feed URLs.
 * Failures on individual feeds are logged and skipped.
 */
export async function fetchRssFeeds(feedUrls: string[]): Promise<RssItem[]> {
  const results = await Promise.allSettled(feedUrls.map(fetchFeed))
  const items: RssItem[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value)
    }
  }

  return items
}

async function fetchFeed(url: string): Promise<RssItem[]> {
  try {
    let targetUrl = url.trim()

    // Support "Search: [query]" syntax using Google News RSS
    if (targetUrl.toLowerCase().startsWith('search:')) {
      const query = targetUrl.slice(7).trim()
      targetUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
    }

    // Try parsing as RSS first
    try {
      const feed = await parser.parseURL(targetUrl)
      const source = feed.title || new URL(targetUrl).hostname

      const items = (feed.items ?? [])
        .filter((item) => item.title && item.link)
        .map((item) => ({
          title: item.title!.trim(),
          url: item.link!,
          source,
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          snippet: item.contentSnippet?.slice(0, 500),
        }))
      log.info({ url: targetUrl, itemCount: items.length }, 'Fetched feed successfully')
      return items
    } catch (rssErr) {
      // If it's not a valid RSS, try a basic HTML scraping fallback
      // (only if it's a standard HTTP/HTTPS link)
      if (targetUrl.startsWith('http')) {
        log.info({ url: targetUrl }, 'Not a valid RSS feed, trying HTML fallback')
        return await scrapeHtmlAsFeed(targetUrl)
      }
      throw rssErr
    }
  } catch (err) {
    log.warn({ err, url }, 'Failed to fetch news source')
    return []
  }
}

/**
 * Basic HTML scraper that attempts to find news-like items on a page.
 * Looks for <a> tags with text and resolves relative links.
 */
async function scrapeHtmlAsFeed(url: string): Promise<RssItem[]> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Daatan-Bot/1.0' },
      next: { revalidate: 3600 },
    } as RequestInit & { next: { revalidate: number } })
    if (!response.ok) return []

    const html = await response.text()
    const source = new URL(url).hostname

    // Very primitive scraping: find all <a> tags that look like headlines
    // (at least 5 words, starts with uppercase)
    const items: RssItem[] = []
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    let match

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1]
      const text = match[2].replace(/<[^>]*>/g, '').trim()

      if (text.length > 20 && /\s/.test(text) && /^[A-Z0-9]/.test(text)) {
        let absoluteUrl = href
        if (href.startsWith('/')) {
          const origin = new URL(url).origin
          absoluteUrl = origin + href
        } else if (!href.startsWith('http')) {
          continue
        }

        items.push({
          title: text,
          url: absoluteUrl,
          source,
          publishedAt: new Date(),
        })
      }
    }

    // Return unique items by URL, limited to top 30
    const seenUrls = new Set<string>()
    return items
      .filter((item) => {
        if (seenUrls.has(item.url)) return false
        seenUrls.add(item.url)
        return true
      })
      .slice(0, 30)
  } catch (err) {
    log.error({ err, url }, 'Scraping fallback failed')
    return []
  }
}

/**
 * Detects "hot" topics — titles that appear across multiple sources
 * within a given time window.
 *
 * Returns groups of related items (same cluster = similar topic).
 * Simple approach: group by keyword overlap in title.
 */
export interface HotTopic {
  /** Representative title from the most-mentioned item */
  title: string
  /** All items that mention this topic */
  items: RssItem[]
  /** Number of distinct sources */
  sourceCount: number
}

export function detectHotTopics(
  items: RssItem[],
  minSources: number,
  windowHours: number,
): HotTopic[] {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000)
  const recent = items.filter((item) => item.publishedAt >= cutoff)

  // Normalize titles to keyword sets for rough similarity
  const clusters: Map<string, RssItem[]> = new Map()

  for (const item of recent) {
    const keywords = extractKeywords(item.title)
    const key = findClusterKey(clusters, keywords)

    if (key) {
      clusters.get(key)!.push(item)
    } else {
      clusters.set(keywords.join(' '), [item])
    }
  }

  const topics: HotTopic[] = []

  for (const [, clusterItems] of clusters) {
    const distinctSources = new Set(clusterItems.map((i) => i.source)).size
    if (distinctSources >= minSources) {
      topics.push({
        title: clusterItems[0].title,
        items: clusterItems,
        sourceCount: distinctSources,
      })
    }
  }

  return topics.sort((a, b) => b.sourceCount - a.sourceCount)
}

/** Extracts significant keywords from a title (removes stop words) */
function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
    'but', 'is', 'are', 'was', 'were', 'has', 'have', 'had', 'will', 'be',
    'with', 'as', 'by', 'from', 'that', 'this', 'it', 'he', 'she', 'they',
    'we', 'you', 'i', 'its', 'not', 'no', 'up', 'out', 'after', 'over',
  ])

  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 6)
}

/** Finds an existing cluster key that shares ≥2 keywords */
function findClusterKey(
  clusters: Map<string, RssItem[]>,
  keywords: string[],
): string | null {
  for (const key of clusters.keys()) {
    const clusterKeywords = key.split(' ')
    const overlap = keywords.filter((k) => clusterKeywords.includes(k)).length
    if (overlap >= 2) return key
  }
  return null
}
