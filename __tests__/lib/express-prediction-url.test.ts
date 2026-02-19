import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const mockSearchArticles = vi.fn()
vi.mock('@/lib/utils/webSearch', () => ({
  searchArticles: (...args: unknown[]) => mockSearchArticles(...args),
}))

const mockFetchUrlContent = vi.fn()
vi.mock('@/lib/utils/scraper', () => ({
  fetchUrlContent: (...args: unknown[]) => mockFetchUrlContent(...args),
}))

const mockGenerateContent = vi.fn()
vi.mock('@/lib/llm/index', () => ({
  llmService: {
    generateContent: (...args: unknown[]) => mockGenerateContent(...args),
  },
}))

import { generateExpressPrediction, extractDomainFromUrl } from '@/lib/llm/expressPrediction'
import type { SearchResult } from '@/lib/utils/webSearch'

// Standard mock data
const mockArticles: SearchResult[] = [
  { title: 'Bitcoin surges past $90k', url: 'https://cnn.com/btc', snippet: 'Bitcoin hit new highs...', source: 'cnn.com', publishedDate: '2026-02-19' },
  { title: 'Crypto market rally continues', url: 'https://bloomberg.com/crypto', snippet: 'The crypto rally...', source: 'bloomberg.com', publishedDate: '2026-02-18' },
  { title: 'BTC analysis', url: 'https://coindesk.com/btc', snippet: 'Analysts predict...', source: 'coindesk.com' },
]

const mockLlmPrediction = {
  claimText: 'Bitcoin will reach $100,000 by December 31, 2026',
  resolveByDatetime: '2026-12-31T23:59:59Z',
  detailsText: 'Bitcoin has been surging recently.',
  tags: ['Crypto'],
  resolutionRules: 'Resolved when BTC crosses $100k on major exchanges.',
  domain: 'General',
  outcomeType: 'BINARY',
  options: [],
}

function setupLlmMock() {
  // The structured prediction call (with schema)
  mockGenerateContent.mockResolvedValue({
    text: JSON.stringify(mockLlmPrediction),
  })
}

describe('extractDomainFromUrl', () => {
  it('extracts domain from a standard URL', () => {
    expect(extractDomainFromUrl('https://www.cnn.com/2026/02/article')).toBe('cnn.com')
  })

  it('extracts domain without www prefix', () => {
    expect(extractDomainFromUrl('https://bloomberg.com/news')).toBe('bloomberg.com')
  })

  it('handles subdomains', () => {
    expect(extractDomainFromUrl('https://news.bbc.co.uk/article')).toBe('news.bbc.co.uk')
  })

  it('returns Unknown for invalid URLs', () => {
    expect(extractDomainFromUrl('not-a-url')).toBe('Unknown')
  })

  it('returns Unknown for empty string', () => {
    expect(extractDomainFromUrl('')).toBe('Unknown')
  })
})

describe('generateExpressPrediction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('text input flow', () => {
    it('searches articles using user text and returns prediction', async () => {
      mockSearchArticles.mockResolvedValue(mockArticles)
      setupLlmMock()

      const result = await generateExpressPrediction('Bitcoin price prediction')

      expect(mockSearchArticles).toHaveBeenCalledWith('Bitcoin price prediction', 5)
      expect(mockFetchUrlContent).not.toHaveBeenCalled()
      expect(result.claimText).toBe(mockLlmPrediction.claimText)
      expect(result.newsAnchor.url).toBe('https://cnn.com/btc')
      expect(result.additionalLinks).toHaveLength(2)
    })

    it('throws NO_ARTICLES_FOUND when search returns empty', async () => {
      mockSearchArticles.mockResolvedValue([])

      await expect(generateExpressPrediction('obscure topic xyz'))
        .rejects.toThrow('NO_ARTICLES_FOUND')
    })

    it('does not treat text with URL-like substrings as URL input', async () => {
      mockSearchArticles.mockResolvedValue(mockArticles)
      setupLlmMock()

      await generateExpressPrediction('check https://cnn.com for news about bitcoin')

      // Should use text search, not URL fetch (input has spaces, not a pure URL)
      expect(mockFetchUrlContent).not.toHaveBeenCalled()
      expect(mockSearchArticles).toHaveBeenCalledWith(
        'check https://cnn.com for news about bitcoin', 5
      )
    })
  })

  describe('URL input flow', () => {
    const testUrl = 'https://www.cnn.com/2026/02/19/business/bitcoin-rally/index.html'

    it('fetches article, extracts topic, and searches for related articles', async () => {
      mockFetchUrlContent.mockResolvedValue('Bitcoin Rally Reaches New Heights. The cryptocurrency market saw unprecedented gains today as Bitcoin surged past $95,000...')
      // First call: topic extraction, second call: structured prediction
      mockGenerateContent
        .mockResolvedValueOnce({ text: 'Bitcoin price rally 2026' })
        .mockResolvedValueOnce({ text: JSON.stringify(mockLlmPrediction) })
      mockSearchArticles.mockResolvedValue(mockArticles)

      const result = await generateExpressPrediction(testUrl)

      // Should fetch the URL content
      expect(mockFetchUrlContent).toHaveBeenCalledWith(testUrl)

      // Should extract topic via LLM
      expect(mockGenerateContent).toHaveBeenCalledTimes(2)
      const topicCall = mockGenerateContent.mock.calls[0][0]
      expect(topicCall.prompt).toContain('Extract the main topic')
      expect(topicCall.temperature).toBe(0)

      // Should search for related articles using extracted topic
      expect(mockSearchArticles).toHaveBeenCalledWith('Bitcoin price rally 2026', 5)

      // Primary article (the URL) should be the news anchor
      expect(result.newsAnchor.url).toBe(testUrl)
      expect(result.newsAnchor.source).toBe('cnn.com')
    })

    it('uses original URL as news anchor, not search results', async () => {
      mockFetchUrlContent.mockResolvedValue('Article about climate change policies in Europe.')
      mockGenerateContent
        .mockResolvedValueOnce({ text: 'European climate policy' })
        .mockResolvedValueOnce({ text: JSON.stringify(mockLlmPrediction) })
      mockSearchArticles.mockResolvedValue(mockArticles)

      const result = await generateExpressPrediction(testUrl)

      expect(result.newsAnchor.url).toBe(testUrl)
    })

    it('deduplicates original URL from search results', async () => {
      mockFetchUrlContent.mockResolvedValue('Some article content here for testing purposes.')
      mockGenerateContent
        .mockResolvedValueOnce({ text: 'test topic' })
        .mockResolvedValueOnce({ text: JSON.stringify(mockLlmPrediction) })
      // Search returns the same URL as one of the results
      mockSearchArticles.mockResolvedValue([
        { title: 'Same article', url: testUrl, snippet: 'Same content', source: 'cnn.com' },
        ...mockArticles,
      ])

      const result = await generateExpressPrediction(testUrl)

      // Original URL should appear once (as news anchor), not duplicated
      const allUrls = [result.newsAnchor.url, ...result.additionalLinks.map(l => l.url)]
      const uniqueUrls = new Set(allUrls)
      expect(uniqueUrls.size).toBe(allUrls.length)
    })

    it('falls back to search when URL fetch fails', async () => {
      mockFetchUrlContent.mockRejectedValue(new Error('Network error'))
      mockSearchArticles.mockResolvedValue(mockArticles)
      setupLlmMock()

      const result = await generateExpressPrediction(testUrl)

      // Should fall back to using URL as search query
      expect(mockSearchArticles).toHaveBeenCalledWith(testUrl, 5)
      // Should NOT have attempted topic extraction
      expect(mockGenerateContent).toHaveBeenCalledTimes(1) // only the prediction call
      expect(result.newsAnchor.url).toBe('https://cnn.com/btc') // first search result
    })

    it('falls back to URL as search topic when topic extraction fails', async () => {
      mockFetchUrlContent.mockResolvedValue('Some article content for testing topic extraction.')
      mockGenerateContent
        .mockRejectedValueOnce(new Error('LLM error')) // topic extraction fails
        .mockResolvedValueOnce({ text: JSON.stringify(mockLlmPrediction) }) // prediction succeeds
      mockSearchArticles.mockResolvedValue(mockArticles)

      const result = await generateExpressPrediction(testUrl)

      // Should fall back to using the URL as search query
      expect(mockSearchArticles).toHaveBeenCalledWith(testUrl, 5)
      expect(result.newsAnchor.url).toBe(testUrl) // primary article is still the URL
    })

    it('works when related article search returns empty', async () => {
      mockFetchUrlContent.mockResolvedValue('Article about a niche topic with no other coverage available.')
      mockGenerateContent
        .mockResolvedValueOnce({ text: 'niche topic' })
        .mockResolvedValueOnce({ text: JSON.stringify(mockLlmPrediction) })
      mockSearchArticles.mockResolvedValue([]) // no related articles found

      const result = await generateExpressPrediction(testUrl)

      // Should still work with just the primary article
      expect(result.newsAnchor.url).toBe(testUrl)
      expect(result.additionalLinks).toHaveLength(0)
    })

    it('strips quotes from extracted topic', async () => {
      mockFetchUrlContent.mockResolvedValue('Article content about something interesting to test with.')
      mockGenerateContent
        .mockResolvedValueOnce({ text: '"Bitcoin rally 2026"' }) // LLM wraps in quotes
        .mockResolvedValueOnce({ text: JSON.stringify(mockLlmPrediction) })
      mockSearchArticles.mockResolvedValue(mockArticles)

      await generateExpressPrediction(testUrl)

      expect(mockSearchArticles).toHaveBeenCalledWith('Bitcoin rally 2026', 5)
    })
  })

  describe('progress callbacks', () => {
    it('emits source summary in found_articles stage', async () => {
      mockSearchArticles.mockResolvedValue(mockArticles)
      setupLlmMock()

      const stages: Array<{ stage: string; data?: Record<string, unknown> }> = []
      await generateExpressPrediction('Bitcoin', (stage, data) => {
        stages.push({ stage, data })
      })

      const foundStage = stages.find(s => s.stage === 'found_articles')
      expect(foundStage).toBeDefined()
      expect(foundStage!.data!.sources).toBe('cnn.com, bloomberg.com, coindesk.com')
      expect(foundStage!.data!.count).toBe(3)
    })

    it('emits source summary with counts for duplicate sources', async () => {
      const articlesWithDupes: SearchResult[] = [
        { title: 'Article 1', url: 'https://cnn.com/a1', snippet: 'Content', source: 'cnn.com' },
        { title: 'Article 2', url: 'https://cnn.com/a2', snippet: 'Content', source: 'cnn.com' },
        { title: 'Article 3', url: 'https://bbc.com/a1', snippet: 'Content', source: 'bbc.com' },
      ]
      mockSearchArticles.mockResolvedValue(articlesWithDupes)
      setupLlmMock()

      const stages: Array<{ stage: string; data?: Record<string, unknown> }> = []
      await generateExpressPrediction('test topic', (stage, data) => {
        stages.push({ stage, data })
      })

      const foundStage = stages.find(s => s.stage === 'found_articles')
      expect(foundStage!.data!.sources).toBe('cnn.com×2, bbc.com')
    })

    it('emits correct stages for URL flow', async () => {
      mockFetchUrlContent.mockResolvedValue('Article content for testing progress callback stages in URL flow.')
      mockGenerateContent
        .mockResolvedValueOnce({ text: 'test topic' })
        .mockResolvedValueOnce({ text: JSON.stringify(mockLlmPrediction) })
      mockSearchArticles.mockResolvedValue(mockArticles)

      const stageNames: string[] = []
      await generateExpressPrediction('https://example.com/article', (stage) => {
        stageNames.push(stage)
      })

      expect(stageNames).toContain('searching')
      expect(stageNames).toContain('found_articles')
      expect(stageNames).toContain('analyzing')
      expect(stageNames).toContain('prediction_formed')
      expect(stageNames).toContain('finalizing')
    })
  })

  describe('URL detection', () => {
    it.each([
      ['https://cnn.com/article', true],
      ['http://example.com', true],
      ['https://www.bbc.co.uk/news/article-123', true],
      ['https://medium.com/@user/my-article-abc123', true],
      ['Bitcoin will reach $100k', false],
      ['check https://cnn.com for news', false],
      ['https://cnn.com and https://bbc.com', false],
      ['not a url at all', false],
    ])('input "%s" detected as URL: %s', async (input, isUrl) => {
      mockSearchArticles.mockResolvedValue(mockArticles)
      mockFetchUrlContent.mockResolvedValue('Some fetched content for URL detection test.')
      // For URL flow: topic extraction + prediction; for text flow: just prediction
      mockGenerateContent.mockResolvedValue({ text: isUrl ? 'extracted topic' : JSON.stringify(mockLlmPrediction) })
      if (isUrl) {
        mockGenerateContent
          .mockResolvedValueOnce({ text: 'extracted topic' })
          .mockResolvedValueOnce({ text: JSON.stringify(mockLlmPrediction) })
      }

      await generateExpressPrediction(input)

      if (isUrl) {
        expect(mockFetchUrlContent).toHaveBeenCalled()
      } else {
        expect(mockFetchUrlContent).not.toHaveBeenCalled()
      }
    })
  })
})
