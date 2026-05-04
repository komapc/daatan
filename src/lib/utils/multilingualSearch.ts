import { searchArticles, type SearchResult } from '@/lib/utils/webSearch'
import { callGeminiTranslate } from '@/lib/services/translation'
import { createLogger } from '@/lib/logger'
import crypto from 'crypto'

const log = createLogger('multilingual-search')

// Cyrillic, Hebrew, Arabic, CJK ranges. If a query has any character in these
// ranges we assume it isn't English and translate before searching.
export const NON_LATIN = /[Ѐ-ӿ֐-׿؀-ۿ一-鿿぀-ヿ]/

// Small in-memory LRU. The express-prediction flow has no prediction ID yet,
// so a content-hash cache is the right granularity.
const TRANSLATION_CACHE = new Map<string, string>()
const TRANSLATION_CACHE_MAX = 500

function hashKey(text: string): string {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 16)
}

async function translateToEnglish(text: string): Promise<string | null> {
  const key = hashKey(text)
  const cached = TRANSLATION_CACHE.get(key)
  if (cached) {
    TRANSLATION_CACHE.delete(key)
    TRANSLATION_CACHE.set(key, cached)
    return cached
  }
  try {
    const translated = (await callGeminiTranslate(text, 'English')).trim()
    if (!translated || translated === text) return null
    if (TRANSLATION_CACHE.size >= TRANSLATION_CACHE_MAX) {
      const firstKey = TRANSLATION_CACHE.keys().next().value
      if (firstKey) TRANSLATION_CACHE.delete(firstKey)
    }
    TRANSLATION_CACHE.set(key, translated)
    return translated
  } catch (err) {
    log.warn({ err }, 'Translate-to-English failed; falling back to single-language search')
    return null
  }
}

function dedupByUrl(items: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  return items.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
}

/**
 * Article search that broadens to English when the query is in a non-Latin
 * script. Web search engines match query terms in their original language, so
 * a Russian/Hebrew claim in → only Russian/Hebrew articles out. We translate
 * once (cached) and run both queries in parallel, putting English results first
 * so they win on dedup.
 */
export async function searchArticlesMultilingual(
  query: string,
  limit: number = 10,
  options?: { dateFrom?: Date; dateTo?: Date }
): Promise<SearchResult[]> {
  // Preserve the upstream call signature when no date window — some callers
  // assert on argument arity in tests.
  const callSearch = (q: string, n: number) =>
    options ? searchArticles(q, n, options) : searchArticles(q, n)

  if (!NON_LATIN.test(query)) {
    return callSearch(query, limit)
  }

  const englishQuery = await translateToEnglish(query)
  if (!englishQuery) {
    return callSearch(query, limit)
  }

  const half = Math.max(1, Math.ceil(limit / 2))
  const [english, original] = await Promise.all([
    callSearch(englishQuery, half).catch(() => [] as SearchResult[]),
    callSearch(query, half).catch(() => [] as SearchResult[]),
  ])

  return dedupByUrl([...english, ...original]).slice(0, limit)
}
