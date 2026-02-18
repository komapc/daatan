import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }),
}))

import {
  notifyForecastPublished,
  notifyNewCommitment,
  notifyNewComment,
  notifyForecastResolved,
} from '@/lib/services/telegram'

describe('Telegram notification service', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_CHAT_ID = '-100123'
    process.env.NEXT_PUBLIC_ENV = 'production'
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('sends forecast published notification', async () => {
    notifyForecastPublished(
      { id: 'p1', claimText: 'Will BTC reach 100k?' },
      { name: 'Mark', username: 'mark' },
    )

    // Allow the fire-and-forget promise to resolve
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce()
    })

    const call = vi.mocked(fetch).mock.calls[0]
    expect(call[0]).toBe('https://api.telegram.org/bottest-token/sendMessage')
    const body = JSON.parse(call[1]!.body as string)
    expect(body.chat_id).toBe('-100123')
    expect(body.text).toContain('New forecast published')
    expect(body.text).toContain('Will BTC reach 100k?')
    expect(body.text).toContain('Mark')
    expect(body.text).not.toContain('🧪')
  })

  it('prefixes with 🧪 on staging', async () => {
    process.env.NEXT_PUBLIC_ENV = 'staging'

    notifyForecastPublished(
      { id: 'p1', claimText: 'Test claim' },
      { name: 'User', username: null },
    )

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce()
    })

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.text).toMatch(/^🧪/)
  })

  it('skips when TELEGRAM_BOT_TOKEN is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN

    notifyForecastPublished(
      { id: 'p1', claimText: 'Test' },
      { name: 'User', username: null },
    )

    // Give a tick for the async function to potentially fire
    await new Promise((r) => setTimeout(r, 50))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends commitment notification with choice', async () => {
    notifyNewCommitment(
      { id: 'p1', claimText: 'Will it rain?' },
      { name: 'Alice', username: 'alice' },
      50,
      'Yes',
    )

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce()
    })

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.text).toContain('Alice')
    expect(body.text).toContain('50 CU')
    expect(body.text).toContain('Yes')
  })

  it('sends comment notification', async () => {
    notifyNewComment(
      { id: 'p1', claimText: 'Some prediction' },
      { name: 'Bob', username: null },
      'I think this is likely',
    )

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce()
    })

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.text).toContain('Bob')
    expect(body.text).toContain('I think this is likely')
  })

  it('sends resolution notification', async () => {
    notifyForecastResolved(
      { id: 'p1', claimText: 'Will BTC moon?' },
      'correct',
      5,
    )

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce()
    })

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.text).toContain('CORRECT')
    expect(body.text).toContain('5 commitments')
  })

  it('does not throw on fetch error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    // Should not throw
    notifyForecastPublished(
      { id: 'p1', claimText: 'Test' },
      { name: 'User', username: null },
    )

    await new Promise((r) => setTimeout(r, 50))
    expect(fetch).toHaveBeenCalledOnce()
  })
})
