import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetOracleSearchHealth, mockNotifySearchCreditsLow, mockNotifyAllSearchProvidersFailed } = vi.hoisted(() => ({
  mockGetOracleSearchHealth: vi.fn(),
  mockNotifySearchCreditsLow: vi.fn(),
  mockNotifyAllSearchProvidersFailed: vi.fn(),
}))

vi.mock('@/lib/services/oracleSearch', () => ({
  getOracleSearchHealth: (...args: unknown[]) => mockGetOracleSearchHealth(...args),
  SEARCH_LOW_CREDITS_THRESHOLD: 100,
}))

vi.mock('@/lib/services/telegram', () => ({
  notifySearchCreditsLow: (...args: unknown[]) => mockNotifySearchCreditsLow(...args),
  notifyAllSearchProvidersFailed: (...args: unknown[]) => mockNotifyAllSearchProvidersFailed(...args),
}))

vi.mock('@/env', () => ({
  env: { BOT_RUNNER_SECRET: 'test-secret' },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

const makeRequest = (secret?: string) =>
  new NextRequest('http://localhost/api/cron/search-health', {
    method: 'GET',
    headers: secret ? { 'x-cron-secret': secret } : {},
  })

describe('GET /api/cron/search-health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when secret is missing', async () => {
    const { GET } = await import('@/app/api/cron/search-health/route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 401 when secret is wrong', async () => {
    const { GET } = await import('@/app/api/cron/search-health/route')
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns ok with skipped=true when oracle not configured', async () => {
    mockGetOracleSearchHealth.mockResolvedValue(null)
    const { GET } = await import('@/app/api/cron/search-health/route')
    const res = await GET(makeRequest('test-secret'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.skipped).toBe(true)
  })

  it('fires notifySearchCreditsLow for exhausted provider', async () => {
    mockGetOracleSearchHealth.mockResolvedValue({
      overall: 'degraded',
      usable_count: 1,
      providers: {
        serper: { configured: true, exhausted: true, status: 'error' },
        serpapi: { configured: true, exhausted: false, status: 'ok', credits: 500 },
      },
    })
    const { GET } = await import('@/app/api/cron/search-health/route')
    await GET(makeRequest('test-secret'))
    expect(mockNotifySearchCreditsLow).toHaveBeenCalledWith('serper', 0)
    expect(mockNotifySearchCreditsLow).not.toHaveBeenCalledWith('serpapi', expect.anything())
  })

  it('fires notifySearchCreditsLow for low-credit provider', async () => {
    mockGetOracleSearchHealth.mockResolvedValue({
      overall: 'healthy',
      usable_count: 2,
      providers: {
        serper: { configured: true, exhausted: false, status: 'ok', credits: 50 },
        serpapi: { configured: true, exhausted: false, status: 'ok', credits: 999 },
      },
    })
    const { GET } = await import('@/app/api/cron/search-health/route')
    await GET(makeRequest('test-secret'))
    expect(mockNotifySearchCreditsLow).toHaveBeenCalledWith('serper', 50)
    expect(mockNotifySearchCreditsLow).not.toHaveBeenCalledWith('serpapi', expect.anything())
  })

  it('fires notifyAllSearchProvidersFailed when overall is unhealthy', async () => {
    mockGetOracleSearchHealth.mockResolvedValue({
      overall: 'unhealthy',
      usable_count: 0,
      providers: {
        serper: { configured: true, exhausted: true, status: 'error' },
      },
    })
    const { GET } = await import('@/app/api/cron/search-health/route')
    await GET(makeRequest('test-secret'))
    expect(mockNotifyAllSearchProvidersFailed).toHaveBeenCalledTimes(1)
  })

  it('does not fire alerts when all providers are healthy', async () => {
    mockGetOracleSearchHealth.mockResolvedValue({
      overall: 'healthy',
      usable_count: 2,
      providers: {
        serper: { configured: true, exhausted: false, status: 'ok', credits: 1000 },
        serpapi: { configured: true, exhausted: false, status: 'ok', credits: 2000 },
      },
    })
    const { GET } = await import('@/app/api/cron/search-health/route')
    const res = await GET(makeRequest('test-secret'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.alerts).toHaveLength(0)
    expect(mockNotifySearchCreditsLow).not.toHaveBeenCalled()
    expect(mockNotifyAllSearchProvidersFailed).not.toHaveBeenCalled()
  })

  it('skips unconfigured providers', async () => {
    mockGetOracleSearchHealth.mockResolvedValue({
      overall: 'healthy',
      usable_count: 1,
      providers: {
        serper: { configured: false, exhausted: false, status: 'not_configured' },
        serpapi: { configured: true, exhausted: false, status: 'ok', credits: 500 },
      },
    })
    const { GET } = await import('@/app/api/cron/search-health/route')
    await GET(makeRequest('test-secret'))
    expect(mockNotifySearchCreditsLow).not.toHaveBeenCalled()
  })
})
