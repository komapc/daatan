import { describe, it, expect } from 'vitest'
import { slugify, generateUniqueSlug } from '@/lib/utils/slugify'

describe('slugify', () => {
  it('converts text to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('Bitcoin @ $100K!')).toBe('bitcoin-100k')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('The quick brown fox')).toBe('the-quick-brown-fox')
  })

  it('removes leading/trailing hyphens', () => {
    expect(slugify('---Test---')).toBe('test')
  })

  it('handles multiple consecutive spaces', () => {
    expect(slugify('Multiple   spaces   here')).toBe('multiple-spaces-here')
  })

  it('limits slug length to 100 characters', () => {
    const longText = 'a'.repeat(150)
    expect(slugify(longText)).toHaveLength(100)
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('handles text with only special characters', () => {
    expect(slugify('!!!@@@###')).toBe('')
  })

  it('preserves numbers', () => {
    expect(slugify('Bitcoin 2026 Prediction')).toBe('bitcoin-2026-prediction')
  })

  it('handles unicode characters', () => {
    expect(slugify('Café résumé naïve')).toBe('caf-rsum-nave')
  })
})

describe('generateUniqueSlug', () => {
  it('returns base slug when no existing slugs', () => {
    expect(generateUniqueSlug('test', [])).toBe('test')
  })

  it('returns base slug when not in existing slugs', () => {
    expect(generateUniqueSlug('test', ['other', 'different'])).toBe('test')
  })

  it('appends counter when slug exists', () => {
    expect(generateUniqueSlug('test', ['test'])).toBe('test-1')
  })

  it('increments counter until unique', () => {
    const existing = ['test', 'test-1', 'test-2']
    expect(generateUniqueSlug('test', existing)).toBe('test-3')
  })

  it('handles multiple similar slugs', () => {
    const existing = ['bitcoin-2026', 'bitcoin-2026-1', 'bitcoin-2026-3']
    expect(generateUniqueSlug('bitcoin-2026', existing)).toBe('bitcoin-2026-2')
  })
})

describe('Prediction slug integration', () => {
  it('creates consistent slugs from same text', () => {
    const text = 'Will Bitcoin reach $100K by 2026?'
    const slug1 = slugify(text)
    const slug2 = slugify(text)
    expect(slug1).toBe(slug2)
  })

  it('creates different slugs for different claims', () => {
    const slug1 = slugify('Bitcoin will reach $100K')
    const slug2 = slugify('Ethereum will reach $10K')
    expect(slug1).not.toBe(slug2)
  })

  it('handles prediction-like text', () => {
    const claim = 'The Russian Federal Security Service (FSB) will gain the legal authority to block communication in Russia by December 31, 2026'
    const slug = slugify(claim)
    expect(slug).toMatch(/^[a-z0-9-]+$/)
    expect(slug.length).toBeLessThanOrEqual(100)
  })
})
