import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { ORACLE_URL: 'https://oracle.example.com', ORACLE_API_KEY: 'test-key' } as Record<string, string>,
}))

vi.mock('@/env', () => ({ env: mockEnv }))
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/lib/services/telegram', () => ({
  notifyOracleSearchUnavailable: vi.fn(),
}))

describe('oracleSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.ORACLE_URL = 'https://oracle.example.com'
    mockEnv.ORACLE_API_KEY = 'test-key'
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'test',
        results: [
          { title: 'T1', url: 'https://a.com', snippet: 'S1', source: 'src', published_date: '2026-01-01' },
        ],
        count: 1,
      }),
    } as Response)
  })

  afterEach(() => vi.restoreAllMocks())

  it('returns mapped results on success', async () => {
    const { oracleSearch } = await import('@/lib/services/oracleSearch')
    const results = await oracleSearch('test query')
    expect(results).toHaveLength(1)
    expect(results![0].title).toBe('T1')
    expect(results![0].url).toBe('https://a.com')
    expect(results![0].publishedDate).toBe('2026-01-01')
  })

  it('returns null when ORACLE_URL is not set', async () => {
    mockEnv.ORACLE_URL = ''
    const { oracleSearch } = await import('@/lib/services/oracleSearch')
    expect(await oracleSearch('test')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null when ORACLE_API_KEY is not set', async () => {
    mockEnv.ORACLE_API_KEY = ''
    const { oracleSearch } = await import('@/lib/services/oracleSearch')
    expect(await oracleSearch('test')).toBeNull()
  })

  it('returns null and alerts on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response)
    const { oracleSearch } = await import('@/lib/services/oracleSearch')
    const { notifyOracleSearchUnavailable } = await import('@/lib/services/telegram')
    expect(await oracleSearch('test')).toBeNull()
    expect(notifyOracleSearchUnavailable).toHaveBeenCalledWith('test')
  })

  it('returns null on fetch error and alerts', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network fail'))
    const { oracleSearch } = await import('@/lib/services/oracleSearch')
    const { notifyOracleSearchUnavailable } = await import('@/lib/services/telegram')
    expect(await oracleSearch('test')).toBeNull()
    expect(notifyOracleSearchUnavailable).toHaveBeenCalled()
  })

  it('returns null when results array is empty', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ query: 'test', results: [], count: 0 }),
    } as Response)
    const { oracleSearch } = await import('@/lib/services/oracleSearch')
    expect(await oracleSearch('test')).toBeNull()
  })

  it('sends dateFrom/dateTo in POST body when provided', async () => {
    const { oracleSearch } = await import('@/lib/services/oracleSearch')
    await oracleSearch('test', 5, { dateFrom: new Date('2026-01-01'), dateTo: new Date('2026-03-01') })
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.date_from).toBe('2026-01-01')
    expect(body.date_to).toBe('2026-03-01')
  })
})

describe('getOracleSearchHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.ORACLE_URL = 'https://oracle.example.com'
    mockEnv.ORACLE_API_KEY = 'test-key'
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        providers: { serper: { configured: true, exhausted: false, status: 'ok', credits: 500 } },
        overall: 'healthy',
        usable_count: 1,
      }),
    } as Response)
  })

  afterEach(() => vi.restoreAllMocks())

  it('returns health data on success', async () => {
    const { getOracleSearchHealth } = await import('@/lib/services/oracleSearch')
    const result = await getOracleSearchHealth()
    expect(result?.overall).toBe('healthy')
    expect(result?.usable_count).toBe(1)
  })

  it('returns null when ORACLE_URL not configured', async () => {
    mockEnv.ORACLE_URL = ''
    const { getOracleSearchHealth } = await import('@/lib/services/oracleSearch')
    expect(await getOracleSearchHealth()).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response)
    const { getOracleSearchHealth } = await import('@/lib/services/oracleSearch')
    expect(await getOracleSearchHealth()).toBeNull()
  })

  it('returns null on fetch error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('timeout'))
    const { getOracleSearchHealth } = await import('@/lib/services/oracleSearch')
    expect(await getOracleSearchHealth()).toBeNull()
  })
})
