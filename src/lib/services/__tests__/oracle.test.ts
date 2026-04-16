/**
 * @jest-environment node
 *
 * Unit tests for the TruthMachine Oracle client. All network calls to the
 * Oracle API are mocked with vi.stubGlobal('fetch', ...).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/env', () => ({
  env: {
    ORACLE_URL: 'https://oracle.daatan.com',
    ORACLE_API_KEY: 'test-key',
  },
}))

import { getOracleForecast, getOracleProbability } from '../oracle'

const sampleSources = [
  {
    source_id: 'reuters',
    source_name: 'Reuters',
    url: 'https://reuters.com/a',
    stance: 0.6,
    certainty: 0.8,
    credibility_weight: 0.95,
    claims: ['Claim A', 'Claim B'],
  },
  {
    source_id: 'blog',
    source_name: 'Random Blog',
    url: 'https://blog.example.com/a',
    stance: -0.3,
    certainty: 0.4,
    credibility_weight: 0.2,
    claims: ['Claim C'],
  },
]

const fullPayload = {
  question: 'Will X happen?',
  mean: 0.3,
  std: 0.12,
  ci_low: 0.05,
  ci_high: 0.55,
  articles_used: 4,
  sources: sampleSources,
  placeholder: false,
}

describe('getOracleForecast', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the full payload on a successful response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => fullPayload,
    })

    const data = await getOracleForecast('Will X happen?')
    expect(data).not.toBeNull()
    expect(data?.mean).toBe(0.3)
    expect(data?.ci_low).toBe(0.05)
    expect(data?.ci_high).toBe(0.55)
    expect(data?.articles_used).toBe(4)
    expect(data?.sources).toHaveLength(2)
    expect(data?.sources[0].source_name).toBe('Reuters')
  })

  it('sends the x-api-key header and posts to /forecast', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => fullPayload })
    await getOracleForecast('Q?')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oracle.daatan.com/forecast')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('test-key')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('returns null when the response is a placeholder', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ...fullPayload, placeholder: true }),
    })
    expect(await getOracleForecast('Q?')).toBeNull()
  })

  it('returns null when articles_used is 0', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ...fullPayload, articles_used: 0 }),
    })
    expect(await getOracleForecast('Q?')).toBeNull()
  })

  it('returns null on non-OK HTTP status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
    expect(await getOracleForecast('Q?')).toBeNull()
  })

  it('returns null when fetch throws (timeout / network error)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('timeout'))
    expect(await getOracleForecast('Q?')).toBeNull()
  })
})

describe('getOracleProbability', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('scales mean from [-1, 1] to [0, 1]', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ...fullPayload, mean: 0.3 }),
    })
    const prob = await getOracleProbability('Q?')
    expect(prob).toBeCloseTo(0.65, 5)
  })

  it('returns null when the full forecast is unavailable', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    expect(await getOracleProbability('Q?')).toBeNull()
  })
})
