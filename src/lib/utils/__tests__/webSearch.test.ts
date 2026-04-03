import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must be set before the module is imported so the guard inside searchArticles sees it
process.env.SERPER_API_KEY = 'test-serper-key'
// SERPAPI_API_KEY intentionally NOT set so tests only hit Serper unless explicitly changed

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

// DDG fallback returns an empty page (no matching result patterns)
const ddgEmptyResponse = () => ({
  ok: true,
  text: async () => '<html><body><p>No results</p></body></html>',
})

// DDG Lite actual HTML structure (single-quoted attributes, direct URLs)
const ddgResultsResponse = (items: { url: string; title: string; snippet: string }[]) => ({
  ok: true,
  text: async () => `<html><body>${items.map(item => `
    <tr><td valign="top">
      <a rel="nofollow" href="${item.url}" class='result-link'>${item.title}</a>
    </td></tr>
    <tr><td class='result-snippet'>${item.snippet}</td></tr>
  `).join('')}</body></html>`,
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
    fetchMock.mockResolvedValue(okResponse({ news: [makeNewsItem()] }))

    await searchArticles('test', 5, {
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-02-24'),
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.tbs).toBe('cdr:1,cd_min:1/1/2026,cd_max:2/24/2026')
  })

  it('does NOT include tbs when no date options are provided', async () => {
    fetchMock.mockResolvedValue(okResponse({ news: [makeNewsItem()] }))

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

  it('falls through to DDG when serper returns no results', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({}))      // Serper: no results
      .mockResolvedValueOnce(ddgEmptyResponse())  // DDG: no results

    const results = await searchArticles('test')
    expect(results).toHaveLength(0)
  })

  it('parses DDG Lite results with single-quoted attributes and direct URLs', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({}))  // Serper: no results
      .mockResolvedValueOnce(ddgResultsResponse([
        { url: 'https://apnews.com/article/1', title: 'AP News Article', snippet: 'Some news snippet.' },
        { url: 'https://reuters.com/article/2', title: 'Reuters Article', snippet: 'Another snippet.' },
      ]))

    const results = await searchArticles('test', 5)
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      title: 'AP News Article',
      url: 'https://apnews.com/article/1',
      snippet: 'Some news snippet.',
      source: 'apnews.com',
    })
    expect(results[1].title).toBe('Reuters Article')
  })

  it('respects the limit parameter', async () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeNewsItem({ title: `Article ${i}`, link: `https://example.com/${i}` })
    )
    fetchMock.mockResolvedValue(okResponse({ news: items }))

    const results = await searchArticles('test', 3)
    expect(results).toHaveLength(3)
  })

  it('falls back to DDG when Serper returns non-OK, returns results from DDG', async () => {
    // Serper fails, DDG returns empty HTML (no matching patterns → empty results)
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Bad Request' })
      .mockResolvedValueOnce(ddgEmptyResponse())

    const results = await searchArticles('test')
    expect(results).toHaveLength(0)
    // Should have called fetch twice: once for Serper, once for DDG
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const ddgCall = fetchMock.mock.calls[1]
    expect(ddgCall[0]).toBe('https://lite.duckduckgo.com/lite/')
  })

  it('throws when all providers fail', async () => {
    // Serper fails, DDG also fails
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
      .mockRejectedValueOnce(new Error('Network failure'))

    await expect(searchArticles('test')).rejects.toThrow('Search API not available')
  })

  it('throws when no providers are configured and DDG fails', async () => {
    const originalSerper = process.env.SERPER_API_KEY
    delete process.env.SERPER_API_KEY
    // DDG fails
    fetchMock.mockRejectedValue(new Error('Network failure'))

    await expect(searchArticles('test')).rejects.toThrow('Search API not available')

    process.env.SERPER_API_KEY = originalSerper
  })

  it('re-throws as Search API not available when Serper has a network error', async () => {
    // Serper network error → DDG also fails
    fetchMock
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockRejectedValueOnce(new Error('Network failure'))

    await expect(searchArticles('test')).rejects.toThrow('Search API not available')
  })
})
