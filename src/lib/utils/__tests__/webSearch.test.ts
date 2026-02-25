import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must be set before the module is imported so the guard inside searchArticles sees it
process.env.SERPER_API_KEY = 'test-serper-key'

const fetchMock = vi.fn()
global.fetch = fetchMock as unknown as typeof fetch

import { searchArticles } from '../webSearch'

const makeNewsItem = (overrides: Record<string, unknown> = {}) => ({
  title: 'Test Article',
  link: 'https://example.com/article',
  snippet: 'Test snippet about the topic',
  date: 'Feb 24, 2026',
  position: 1,
  ...overrides,
})

const okResponse = (body: unknown) => ({
  ok: true,
  json: async () => body,
})

describe('searchArticles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls the Serper /news endpoint (not /search)', async () => {
    fetchMock.mockResolvedValue(okResponse({ news: [makeNewsItem()] }))

    await searchArticles('shekel dollar exchange rate')

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('https://google.serper.dev/news')
  })

  it('sends the query and API key in the request', async () => {
    fetchMock.mockResolvedValue(okResponse({ news: [makeNewsItem()] }))

    await searchArticles('shekel dollar exchange rate')

    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.q).toBe('shekel dollar exchange rate')
    expect(init.headers['X-API-KEY']).toBe('test-serper-key')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('maps news results to the SearchResult shape with publishedDate', async () => {
    fetchMock.mockResolvedValue(okResponse({
      news: [makeNewsItem({ title: 'Shekel hits 30-year high', link: 'https://timesofisrael.com/article', date: 'Feb 10, 2026' })],
    }))

    const results = await searchArticles('shekel')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      title: 'Shekel hits 30-year high',
      url: 'https://timesofisrael.com/article',
      snippet: 'Test snippet about the topic',
      source: 'timesofisrael.com',
      publishedDate: 'Feb 10, 2026',
    })
  })

  it('strips www. from domain in source field', async () => {
    fetchMock.mockResolvedValue(okResponse({
      news: [makeNewsItem({ link: 'https://www.reuters.com/article' })],
    }))

    const results = await searchArticles('test')
    expect(results[0].source).toBe('reuters.com')
  })

  it('applies tbs date filter when both dateFrom and dateTo are provided', async () => {
    fetchMock.mockResolvedValue(okResponse({ news: [] }))

    await searchArticles('test', 5, {
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-02-24'),
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.tbs).toBe('cdr:1,cd_min:1/1/2026,cd_max:2/24/2026')
  })

  it('does NOT include tbs when no date options are provided', async () => {
    fetchMock.mockResolvedValue(okResponse({ news: [] }))

    await searchArticles('test')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.tbs).toBeUndefined()
  })

  it('falls back to organic results when news array is empty', async () => {
    fetchMock.mockResolvedValue(okResponse({
      news: [],
      organic: [makeNewsItem({ title: 'Organic result' })],
    }))

    const results = await searchArticles('test')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Organic result')
  })

  it('returns empty array when both news and organic are absent', async () => {
    fetchMock.mockResolvedValue(okResponse({}))

    const results = await searchArticles('test')
    expect(results).toHaveLength(0)
  })

  it('respects the limit parameter', async () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeNewsItem({ title: `Article ${i}`, link: `https://example.com/${i}` })
    )
    fetchMock.mockResolvedValue(okResponse({ news: items }))

    const results = await searchArticles('test', 3)
    expect(results).toHaveLength(3)
  })

  it('throws when SERPER_API_KEY is not configured', async () => {
    const original = process.env.SERPER_API_KEY
    delete process.env.SERPER_API_KEY
    await expect(searchArticles('test')).rejects.toThrow('Search API not configured')
    process.env.SERPER_API_KEY = original
  })

  it('throws when Serper API returns a non-OK status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 })
    await expect(searchArticles('test')).rejects.toThrow('Search API error: 401')
  })

  it('re-throws network errors', async () => {
    fetchMock.mockRejectedValue(new Error('Network failure'))
    await expect(searchArticles('test')).rejects.toThrow('Network failure')
  })
})
