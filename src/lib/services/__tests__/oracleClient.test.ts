/**
 * @jest-environment node
 *
 * Unit tests for the shared Oracle HTTP client helpers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mutable env mock, hoisted so it exists before the vi.mock factory runs.
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {} as { ORACLE_URL?: string; ORACLE_API_KEY?: string },
}))
vi.mock('@/env', () => ({ env: mockEnv }))

import { getOracleBaseUrl, getOracleConfig, oracleFetch } from '../oracleClient'

beforeEach(() => {
  mockEnv.ORACLE_URL = undefined
  mockEnv.ORACLE_API_KEY = undefined
})

describe('getOracleConfig', () => {
  it('returns null when URL or key is missing', () => {
    expect(getOracleConfig()).toBeNull()
    mockEnv.ORACLE_URL = 'https://oracle.daatan.com'
    expect(getOracleConfig()).toBeNull() // key still missing
    mockEnv.ORACLE_URL = undefined
    mockEnv.ORACLE_API_KEY = 'k'
    expect(getOracleConfig()).toBeNull() // url missing
  })

  it('returns normalized base URL + key, stripping a trailing slash', () => {
    mockEnv.ORACLE_URL = 'https://oracle.daatan.com/'
    mockEnv.ORACLE_API_KEY = 'secret'
    expect(getOracleConfig()).toEqual({ baseUrl: 'https://oracle.daatan.com', key: 'secret' })
  })
})

describe('getOracleBaseUrl', () => {
  it('returns null when URL is unset (no key required)', () => {
    expect(getOracleBaseUrl()).toBeNull()
  })

  it('returns the normalized URL without requiring a key', () => {
    mockEnv.ORACLE_URL = 'https://oracle.daatan.com/'
    expect(getOracleBaseUrl()).toBe('https://oracle.daatan.com')
  })
})

describe('oracleFetch', () => {
  it('builds the URL, adds the x-api-key header, merges caller headers and sets an abort signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)

    await oracleFetch(
      { baseUrl: 'https://oracle.daatan.com', key: 'secret' },
      '/forecast',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', timeoutMs: 1234 },
    )

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oracle.daatan.com/forecast')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{}')
    expect(init.headers['x-api-key']).toBe('secret')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect('timeoutMs' in init).toBe(false)

    vi.unstubAllGlobals()
  })
})
