/**
 * @jest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — must be declared before any import that transitively uses them
// ---------------------------------------------------------------------------

// Strip authentication — call the inner handler directly with a mock admin user
vi.mock('@/lib/api-middleware', () => ({
  withAuth: (handler: Function) =>
    (request: Request, context: { params: { id: string } }) =>
      handler(request, { id: 'admin-user', role: 'ADMIN' }, context),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    prediction: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/utils/webSearch', () => ({
  searchArticles: vi.fn(),
}))

const generateContentMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/llm', () => ({
  llmService: { generateContent: generateContentMock },
}))

vi.mock('@/lib/api-error', () => ({
  apiError: (msg: string, status: number) => new Response(JSON.stringify({ error: msg }), { status }),
  handleRouteError: (err: unknown, msg: string) =>
    new Response(JSON.stringify({ error: msg }), { status: 500 }),
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { searchArticles } from '@/lib/utils/webSearch'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const basePrediction = {
  id: 'pred-1',
  claimText: 'The Israeli Shekel will strengthen against the US Dollar by end of February 2026',
  outcomeType: 'BINARY',
  resolutionRules: null,
  publishedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  resolveByDatetime: new Date('2026-02-24'),
  options: [],
}

let _articleSeq = 0
const makeArticle = (title: string, source = 'example.com') => ({
  title,
  url: `https://${source}/article-${++_articleSeq}`,
  snippet: `${title} — detailed report`,
  source,
  publishedDate: 'Feb 10, 2026',
})

const makeRequest = (id = 'pred-1') =>
  new NextRequest(`http://localhost/api/forecasts/${id}/research`, { method: 'POST' })

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/forecasts/[id]/research', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: three parallel searches all return relevant shekel articles
    vi.mocked(searchArticles).mockResolvedValue([
      makeArticle('Shekel hits 30-year high', 'timesofisrael.com'),
      makeArticle('Shekel continues rise', 'jns.org'),
      makeArticle('ILS strengthens against dollar', 'reuters.com'),
    ])
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        outcome: 'correct',
        reasoning: 'Multiple sources confirm the shekel strengthened.',
        evidenceLinks: ['https://timesofisrael.com/article'],
      }),
    })
  })

  it('returns 404 when the prediction is not found', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(null)

    const response = await POST(makeRequest(), { params: { id: 'missing' } })
    expect(response.status).toBe(404)
  })

  it('runs three parallel searches and merges results', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(basePrediction as never)

    await POST(makeRequest(), { params: { id: 'pred-1' } })

    // Three searchArticles calls: dated, broad, simplified
    expect(searchArticles).toHaveBeenCalledTimes(3)
  })

  it('the simplified query strips stopwords and includes the resolution year', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(basePrediction as never)

    await POST(makeRequest(), { params: { id: 'pred-1' } })

    const calls = vi.mocked(searchArticles).mock.calls
    // The third call is the simplified/keyword query
    const simplifiedQuery: string = calls[2][0]
    expect(simplifiedQuery.toLowerCase()).not.toMatch(/\bwill\b/)
    expect(simplifiedQuery.toLowerCase()).not.toMatch(/\bthe\b/)
    expect(simplifiedQuery).toContain('2026')
  })

  it('passes date range to dated and simplified searches', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(basePrediction as never)

    await POST(makeRequest(), { params: { id: 'pred-1' } })

    const calls = vi.mocked(searchArticles).mock.calls
    // calls[0] = dated, calls[2] = simplified — both receive dateFrom/dateTo
    expect(calls[0][2]).toMatchObject({ dateFrom: expect.any(Date), dateTo: expect.any(Date) })
    expect(calls[2][2]).toMatchObject({ dateFrom: expect.any(Date), dateTo: expect.any(Date) })
    // calls[1] = broad — no date options
    expect(calls[1][2]).toBeUndefined()
  })

  it('returns the LLM outcome as JSON', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(basePrediction as never)

    const response = await POST(makeRequest(), { params: { id: 'pred-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.outcome).toBe('correct')
    expect(data.reasoning).toBeTruthy()
    expect(data.evidenceLinks).toBeInstanceOf(Array)
  })

  it('triggers LLM fallback queries when initial results are irrelevant', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(basePrediction as never)

    // Return only unrelated articles — no "Shekel"/"Israeli" capitalised nouns present
    vi.mocked(searchArticles).mockResolvedValue([
      makeArticle('US tariff ruling chaos'),
      makeArticle('Philippine peso update'),
    ])

    // First LLM call = query generation, second = evaluation
    generateContentMock
      .mockResolvedValueOnce({ text: JSON.stringify({ queries: ['shekel usd rate 2026', 'ILS dollar February'] }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ outcome: 'correct', reasoning: 'ok', evidenceLinks: [] }) })

    await POST(makeRequest(), { params: { id: 'pred-1' } })

    // 3 initial + 2 fallback = 5 total searchArticles calls
    expect(searchArticles).toHaveBeenCalledTimes(5)
    // LLM was called twice: once for query gen, once for evaluation
    expect(generateContentMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT trigger LLM fallback when initial results are relevant', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(basePrediction as never)
    // Articles mention "Israeli" and "Shekel" — relevant
    vi.mocked(searchArticles).mockResolvedValue([
      makeArticle('Israeli Shekel hits high'),
      makeArticle('Israeli economy update'),
      makeArticle('Shekel dollar exchange'),
    ])

    await POST(makeRequest(), { params: { id: 'pred-1' } })

    // Only 3 initial searches, LLM called once for evaluation only
    expect(searchArticles).toHaveBeenCalledTimes(3)
    expect(generateContentMock).toHaveBeenCalledTimes(1)
  })

  it('includes published dates in the LLM context', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(basePrediction as never)
    vi.mocked(searchArticles).mockResolvedValue([
      makeArticle('Israeli Shekel strengthens', 'timesofisrael.com'),
      makeArticle('Shekel at 30-year high', 'jns.org'),
      makeArticle('Israeli currency rises', 'reuters.com'),
    ])

    await POST(makeRequest(), { params: { id: 'pred-1' } })

    // LLM is called exactly once (evaluation only — no fallback with 3 relevant articles)
    expect(generateContentMock).toHaveBeenCalledTimes(1)
    const promptArg: string = generateContentMock.mock.calls[0][0].prompt
    expect(promptArg).toContain('Feb 10, 2026')
  })

  it('passes the forecast period dates to the LLM prompt', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(basePrediction as never)

    await POST(makeRequest(), { params: { id: 'pred-1' } })

    const promptArg: string = generateContentMock.mock.calls[0][0].prompt
    expect(promptArg).toContain('2026-01-01')  // forecastStart
    expect(promptArg).toContain('2026-02-24')  // forecastEnd
  })

  it('tells LLM to use its own knowledge when search context is empty', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(basePrediction as never)
    vi.mocked(searchArticles).mockResolvedValue([])
    // Fallback LLM queries also return nothing
    generateContentMock
      .mockResolvedValueOnce({ text: JSON.stringify({ queries: ['shekel usd'] }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ outcome: 'wrong', reasoning: 'no evidence', evidenceLinks: [] }) })

    await POST(makeRequest(), { params: { id: 'pred-1' } })

    const evalPrompt: string = generateContentMock.mock.calls[1][0].prompt
    expect(evalPrompt).toContain('Rely on your training knowledge')
    expect(evalPrompt).toContain('Do NOT default to')
  })

  it('includes MULTIPLE_CHOICE options in the LLM prompt', async () => {
    const mcPrediction = {
      ...basePrediction,
      outcomeType: 'MULTIPLE_CHOICE',
      options: [
        { id: 'opt-1', text: 'Yes, it strengthens' },
        { id: 'opt-2', text: 'No, it weakens' },
      ],
    }
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(mcPrediction as never)
    vi.mocked(searchArticles).mockResolvedValue([
      makeArticle('Israeli Shekel surges', 'timesofisrael.com'),
      makeArticle('Israeli economy boom', 'jns.org'),
      makeArticle('Shekel dollar rate rises', 'reuters.com'),
    ])

    await POST(makeRequest(), { params: { id: 'pred-1' } })

    // LLM called once (evaluation only)
    expect(generateContentMock).toHaveBeenCalledTimes(1)
    const promptArg: string = generateContentMock.mock.calls[0][0].prompt
    expect(promptArg).toContain('MULTIPLE CHOICE')
    expect(promptArg).toContain('opt-1')
    expect(promptArg).toContain('Yes, it strengthens')
  })

  it('continues gracefully when the fallback LLM query generation fails', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(basePrediction as never)
    vi.mocked(searchArticles).mockResolvedValue([]) // triggers fallback

    // First call (query gen) throws, second call (evaluation) succeeds
    generateContentMock
      .mockRejectedValueOnce(new Error('LLM rate limit'))
      .mockResolvedValueOnce({ text: JSON.stringify({ outcome: 'unresolvable', reasoning: 'no data', evidenceLinks: [] }) })

    const response = await POST(makeRequest(), { params: { id: 'pred-1' } })
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.outcome).toBe('unresolvable')
  })

  it('continues gracefully when a fallback search call fails', async () => {
    vi.mocked(prisma.prediction.findUnique).mockResolvedValue(basePrediction as never)
    // Initial searches return irrelevant results → fallback triggered
    vi.mocked(searchArticles)
      .mockResolvedValueOnce([makeArticle('Tariff news')])  // dated
      .mockResolvedValueOnce([makeArticle('Tariff court')])  // broad
      .mockResolvedValueOnce([makeArticle('Trade war')])     // simplified
      .mockRejectedValue(new Error('Search timeout'))        // fallback searches fail

    generateContentMock
      .mockResolvedValueOnce({ text: JSON.stringify({ queries: ['shekel usd', 'ILS rate'] }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ outcome: 'unresolvable', reasoning: 'fallback failed', evidenceLinks: [] }) })

    const response = await POST(makeRequest(), { params: { id: 'pred-1' } })
    expect(response.status).toBe(200)
  })
})
