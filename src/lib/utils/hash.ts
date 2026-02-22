import crypto from 'crypto'

/**
 * Normalizes a URL and generates a SHA-256 hash.
 * Used for deduplicating news anchors and articles.
 * Normalization includes:
 * 1. Lowercasing the URL
 * 2. Removing the protocol (http/https)
 * 3. Removing trailing slashes
 * This ensures that 'HTTPS://example.com/' and 'http://example.com' 
 * produce the same hash.
 */
export function hashUrl(url: string): string {
  const normalizedUrl = url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
  return crypto.createHash('sha256').update(normalizedUrl).digest('hex')
}
