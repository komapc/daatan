import crypto from 'crypto'

/**
 * Normalizes a URL and generates a SHA-256 hash.
 * Used for deduplicating news anchors and articles.
 */
export function hashUrl(url: string): string {
  const normalizedUrl = url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
  return crypto.createHash('sha256').update(normalizedUrl).digest('hex')
}
