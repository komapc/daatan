import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { $executeRaw: vi.fn() },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}))

import { embedText, embedAndStoreForecast } from '../embedding'
import { prisma } from '@/lib/prisma'

const FAKE_768 = Array.from({ length: 768 }, (_, i) => i / 768)

describe('embedText', () => {
  const originalEnv = process.env.GEMINI_API_KEY

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv
    vi.unstubAllGlobals()
  })

  it('returns null and does not fetch when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY
    const result = await embedText('hello')
    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns 768-dim vector on successful API call', async () => {
    process.env.GEMINI_API_KEY = 'fake-key'
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ embedding: { values: FAKE_768 } }), { status: 200 })
    )

    const result = await embedText('some text')
    expect(result).toHaveLength(768)
    expect(result![0]).toBeCloseTo(0)
  })

  it('passes outputDimensionality: 768 in the request body', async () => {
    process.env.GEMINI_API_KEY = 'fake-key'
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ embedding: { values: FAKE_768 } }), { status: 200 })
    )

    await embedText('test')

    const [, opts] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse((opts as RequestInit).body as string)
    expect(body.outputDimensionality).toBe(768)
    expect(body.model).toContain('gemini-embedding-2')
  })

  it('returns null on non-200 API response', async () => {
    process.env.GEMINI_API_KEY = 'fake-key'
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 })
    )

    const result = await embedText('hello')
    expect(result).toBeNull()
  })

  it('returns null on fetch error', async () => {
    process.env.GEMINI_API_KEY = 'fake-key'
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    const result = await embedText('hello')
    expect(result).toBeNull()
  })

  it('returns null when dimension does not match 768', async () => {
    process.env.GEMINI_API_KEY = 'fake-key'
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ embedding: { values: [1, 2, 3] } }), { status: 200 })
    )

    const result = await embedText('hello')
    expect(result).toBeNull()
  })
})

describe('embedAndStoreForecast', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'fake-key'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('calls $executeRaw to update the embedding column', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ embedding: { values: FAKE_768 } }), { status: 200 })
    )
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1)

    await embedAndStoreForecast('pred-1', 'claim text')

    expect(prisma.$executeRaw).toHaveBeenCalledOnce()
  })

  it('does not call $executeRaw if embedding fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fail'))

    await embedAndStoreForecast('pred-1', 'claim text')

    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })
})
