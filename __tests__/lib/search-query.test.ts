import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGenerateContent } = vi.hoisted(() => ({ mockGenerateContent: vi.fn() }))

vi.mock('@/lib/llm', () => ({
  llmService: { generateContent: (...args: unknown[]) => mockGenerateContent(...args) },
}))

import { buildSearchQuery, cleanClaimForSearch } from '@/lib/llm/searchQuery'

describe('cleanClaimForSearch', () => {
  it('strips a leading emoji prefix', () => {
    expect(cleanClaimForSearch('🤖 EU will admit two members')).toBe('EU will admit two members')
  })

  it('takes the segment before a title separator', () => {
    expect(cleanClaimForSearch('EU enlargement | extra title')).toBe('EU enlargement')
  })

  it('trims whitespace', () => {
    expect(cleanClaimForSearch('  hello world  ')).toBe('hello world')
  })
})

describe('buildSearchQuery', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('returns the LLM-extracted query on success', async () => {
    mockGenerateContent.mockResolvedValue({ text: '  "EU enlargement accession"  ' })
    const q = await buildSearchQuery('The EU will admit at least two new member states by 2028')
    expect(q).toBe('EU enlargement accession') // quotes + whitespace stripped
  })

  it('falls back to the cleaned claim when extraction throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('LLM down'))
    const q = await buildSearchQuery('🤖 Bitcoin will reach $100k | tag')
    expect(q).toBe('Bitcoin will reach $100k')
  })

  it('falls back to the cleaned claim when extraction returns empty', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' })
    const q = await buildSearchQuery('Some claim text')
    expect(q).toBe('Some claim text')
  })

  it('falls back to the cleaned claim when extraction exceeds the timeout', async () => {
    // Resolve well after the 2s timeout; the race must return the cleaned claim first.
    mockGenerateContent.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ text: 'too late' }), 5_000)),
    )
    const q = await buildSearchQuery('Slow claim')
    expect(q).toBe('Slow claim')
  })
})
