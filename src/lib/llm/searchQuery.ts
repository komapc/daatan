import { llmService } from './index'
import { createLogger } from '@/lib/logger'

const log = createLogger('search-query')

/** Max time to wait for LLM keyword extraction before falling back to the cleaned claim. */
const QUERY_TIMEOUT_MS = 2_000

/**
 * Strip a leading emoji prefix (e.g. the "🤖 " on bot forecasts) and take the
 * segment before a title separator. Mirrors the cleanup the context route used
 * inline; safe to use as a standalone fallback query.
 */
export function cleanClaimForSearch(claim: string): string {
  return claim
    .split(/\s+[|—–]\s+/)[0]
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*/gu, '')
    .trim()
}

const EXTRACTION_PROMPT = `Turn this forecast claim into a concise web-search query that retrieves news coverage of the underlying topic.
- Keep the key named entities and the core subject.
- Drop filler, hedging, probability wording, and specific dates.
- Output 3-8 words only. No quotes, no punctuation, no explanation.

Claim: "{claim}"

Search query:`

/**
 * Turn a full-sentence forecast claim into a focused search query via a fast
 * LLM call. Sentence-style claims retrieve poorly; key entities/topic do better.
 *
 * Resilient by design: the extraction races a {@link QUERY_TIMEOUT_MS} timeout
 * and any failure/empty/slow result falls back to the cleaned claim, so a flaky
 * or slow model never blocks (or degrades) search.
 */
export async function buildSearchQuery(claim: string): Promise<string> {
  const cleaned = cleanClaimForSearch(claim)
  if (cleaned.length === 0) return claim.trim()

  const extraction = (async (): Promise<string> => {
    const prompt = EXTRACTION_PROMPT.replace('{claim}', () => cleaned)
    const res = await llmService.generateContent({ prompt, temperature: 0 })
    return res.text.trim().replace(/^["']+|["']+$/g, '').replace(/\s+/g, ' ').trim()
  })()

  try {
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), QUERY_TIMEOUT_MS))
    const result = await Promise.race([extraction, timeout])
    if (result && result.length >= 2) {
      log.info({ query: result }, 'search-query: extracted')
      return result
    }
    log.warn('search-query: extraction empty or timed out — using cleaned claim')
    return cleaned
  } catch (err) {
    log.warn({ err }, 'search-query: extraction failed — using cleaned claim')
    return cleaned
  }
}
