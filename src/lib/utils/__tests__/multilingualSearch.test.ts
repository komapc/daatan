import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/services/oracleSearch', () => ({
  oracleSearch: vi.fn(),
}))

vi.mock('@/lib/services/translation', () => ({
  callGeminiTranslate: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}))

import { searchArticlesMultilingual } from '../multilingualSearch'
import { oracleSearch } from '@/lib/services/oracleSearch'
import { callGeminiTranslate } from '@/lib/services/translation'

const fakeResult = (id: string) => ({
  title: `Title ${id}`,
  url: `https://example.com/${id}`,
  snippet: `Snippet ${id}`,
})

describe('searchArticlesMultilingual', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes through to oracleSearch for Latin-only queries (no translation)', async () => {
    vi.mocked(oracleSearch).mockResolvedValue([fakeResult('a')])

    await searchArticlesMultilingual('Bitcoin will reach $200k', 5)

    expect(callGeminiTranslate).not.toHaveBeenCalled()
    expect(oracleSearch).toHaveBeenCalledOnce()
    expect(oracleSearch).toHaveBeenCalledWith('Bitcoin will reach $200k', 5, undefined, { source: 'multilingual-search' })
  })

  it('translates Cyrillic queries and runs both searches in parallel', async () => {
    vi.mocked(callGeminiTranslate).mockResolvedValue('Bitcoin will reach $200k')
    vi.mocked(oracleSearch)
      .mockResolvedValueOnce([fakeResult('en1'), fakeResult('en2')])
      .mockResolvedValueOnce([fakeResult('ru1'), fakeResult('ru2')])

    const results = await searchArticlesMultilingual('Биткоин достигнет 200 тысяч', 4)

    expect(callGeminiTranslate).toHaveBeenCalledWith('Биткоин достигнет 200 тысяч', 'English')
    expect(oracleSearch).toHaveBeenCalledTimes(2)
    expect(results).toHaveLength(4)
    // English first
    expect(results[0].url).toBe('https://example.com/en1')
  })

  it('translates Hebrew queries', async () => {
    vi.mocked(callGeminiTranslate).mockResolvedValue('Hezbollah hostage release')
    vi.mocked(oracleSearch).mockResolvedValue([])

    await searchArticlesMultilingual('ארגון חיזבאללה ישחרר', 4)

    expect(callGeminiTranslate).toHaveBeenCalledOnce()
  })

  it('deduplicates by URL with English winning', async () => {
    vi.mocked(callGeminiTranslate).mockResolvedValue('translated query')
    vi.mocked(oracleSearch)
      .mockResolvedValueOnce([
        { title: 'EN', url: 'https://shared.com/x', snippet: 'en-snippet' },
      ])
      .mockResolvedValueOnce([
        { title: 'RU', url: 'https://shared.com/x', snippet: 'ru-snippet' },
      ])

    const results = await searchArticlesMultilingual('Тест запрос', 4)

    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('EN')
  })

  it('falls back to single-language search when translation fails', async () => {
    vi.mocked(callGeminiTranslate).mockRejectedValue(new Error('quota'))
    vi.mocked(oracleSearch).mockResolvedValue([fakeResult('ru')])

    const results = await searchArticlesMultilingual('Тест', 5)

    expect(oracleSearch).toHaveBeenCalledOnce()
    expect(results).toHaveLength(1)
  })

  it('falls back to single search when translation returns the same text', async () => {
    vi.mocked(callGeminiTranslate).mockResolvedValue('Тест')
    vi.mocked(oracleSearch).mockResolvedValue([fakeResult('ru')])

    await searchArticlesMultilingual('Тест', 5)

    expect(oracleSearch).toHaveBeenCalledOnce()
  })

  it('caches translations: same Cyrillic query twice → one translate call', async () => {
    vi.mocked(callGeminiTranslate).mockResolvedValue('translated once')
    vi.mocked(oracleSearch).mockResolvedValue([])

    await searchArticlesMultilingual('Уникальный запрос для кеша', 4)
    await searchArticlesMultilingual('Уникальный запрос для кеша', 4)

    expect(callGeminiTranslate).toHaveBeenCalledOnce()
  })

  it('does not call translate for English even when long', async () => {
    vi.mocked(oracleSearch).mockResolvedValue([])
    await searchArticlesMultilingual('A very long English query about Bitcoin and 2026', 5)
    expect(callGeminiTranslate).not.toHaveBeenCalled()
  })
})
