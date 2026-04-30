import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import {
  notifyForecastPublished,
  notifyNewCommitment,
  notifyNewComment,
  notifyForecastResolved,
  notifyBotForecastApproved,
  notifyBotForecastRejected,
  notifyNewUserRegistered,
  notifyServerError,
  notifySecurityError,
  notifyResourceNotFound,
  notifyLlmError,
  notifyDiskSpaceLow,
  notifyMemoryPressure,
  notifyHighLoad,
  notifyHeartbeat,
  notifyBackupVerificationFailed,
  notifyAllSearchProvidersFailed,
  notifyOracleSearchUnavailable,
  notifySearchCreditsLow,
} from '@/lib/services/telegram'

describe('Telegram notification service', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_CHAT_ID = '-100123'
    process.env.APP_ENV = 'production'
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
    expect(body.text).toMatch(/^\[prod\]/)
  })

  it('prefixes with [staging] on staging', async () => {
    process.env.APP_ENV = 'staging'

    notifyForecastPublished(
      { id: 'p1', claimText: 'Test claim' },
      { name: 'User', username: null },
    )

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce()
    })

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.text).toMatch(/^\[staging\]/)
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

// Helper shared by all remaining tests
function waitForFetch() {
  return vi.waitFor(() => { expect(fetch).toHaveBeenCalledOnce() })
}

function body() {
  return JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
}

describe('remaining notification functions', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_CHAT_ID = '-100123'
    process.env.APP_ENV = 'production'
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('notifyBotForecastApproved sends approved message', async () => {
    notifyBotForecastApproved(
      { id: 'p1', claimText: 'Bot claim' },
      { name: 'BotUser', username: 'bot_b' },
      { name: 'Admin', username: 'admin' },
    )
    await waitForFetch()
    expect(body().text).toContain('Bot forecast approved')
    expect(body().text).toContain('BotUser')
    expect(body().text).toContain('Admin')
  })

  it('notifyBotForecastRejected sends rejected message', async () => {
    notifyBotForecastRejected(
      { id: 'p1', claimText: 'Bot claim' },
      { name: 'BotUser', username: 'bot_b' },
      { name: 'Admin', username: 'admin' },
    )
    await waitForFetch()
    expect(body().text).toContain('Bot forecast rejected')
  })

  it('notifyNewUserRegistered sends new user message', async () => {
    notifyNewUserRegistered({ email: 'x@y.com', name: 'Newbie', provider: 'google' })
    await waitForFetch()
    expect(body().text).toContain('New user registered')
    expect(body().text).toContain('x@y.com')
    expect(body().text).toContain('Newbie')
  })

  it('notifyServerError sends error message (first call, not rate-limited)', async () => {
    notifyServerError('/api/test', new Error('Oops'))
    await waitForFetch()
    expect(body().text).toContain('Server Error')
    expect(body().text).toContain('/api/test')
    expect(body().text).toContain('Oops')
  })

  it('notifySecurityError sends security event message', async () => {
    notifySecurityError('/api/admin', 403, 'Forbidden', { id: 'u1', email: 'h@k.com' })
    await waitForFetch()
    expect(body().text).toContain('Security Event')
    expect(body().text).toContain('403')
  })

  it('notifyResourceNotFound sends 404 message', async () => {
    notifyResourceNotFound('/old/path', 'was deleted')
    await waitForFetch()
    expect(body().text).toContain('Dead Link')
    expect(body().text).toContain('/old/path')
  })

  it('notifyLlmError sends LLM error message', async () => {
    notifyLlmError('gemini', 'quota exceeded', 'gemini-pro')
    await waitForFetch()
    expect(body().text).toContain('LLM Provider Error')
    expect(body().text).toContain('gemini')
  })

  it('notifyDiskSpaceLow sends disk message', async () => {
    notifyDiskSpaceLow('i-abc', '95%', '90%')
    await waitForFetch()
    expect(body().text).toContain('Disk Space Low')
    expect(body().text).toContain('i-abc')
  })

  it('notifyMemoryPressure sends memory message', async () => {
    notifyMemoryPressure('i-abc', 7500, 8000, 94)
    await waitForFetch()
    expect(body().text).toContain('Memory Pressure')
  })

  it('notifyHighLoad sends CPU message', async () => {
    notifyHighLoad('i-abc', '7.5', '6.2', 4)
    await waitForFetch()
    expect(body().text).toContain('High CPU Load')
  })

  it('notifyHeartbeat sends heartbeat message', async () => {
    notifyHeartbeat('1.10.63')
    await waitForFetch()
    expect(body().text).toContain('heartbeat')
    expect(body().text).toContain('1.10.63')
  })

  it('notifyBackupVerificationFailed sends backup failure message', async () => {
    notifyBackupVerificationFailed('restore failed: timeout')
    await waitForFetch()
    expect(body().text).toContain('Backup Verification FAILED')
    expect(body().text).toContain('restore failed')
  })

  it('notifyAllSearchProvidersFailed sends search failure message', async () => {
    notifyAllSearchProvidersFailed('BTC rally')
    await waitForFetch()
    expect(body().text).toContain('All search providers failed')
  })

  it('notifyOracleSearchUnavailable sends oracle unavailable message', async () => {
    notifyOracleSearchUnavailable('some query')
    await waitForFetch()
    expect(body().text).toContain('Oracle /search unavailable')
  })

  it('notifySearchCreditsLow sends low credits message', async () => {
    notifySearchCreditsLow('serper', 45)
    await waitForFetch()
    expect(body().text).toContain('Search credits low')
    expect(body().text).toContain('serper')
    expect(body().text).toContain('45')
  })

  it('suppresses all operational alerts in dev env', async () => {
    process.env.APP_ENV = 'development'
    notifyServerError('/test', new Error('dev error'))
    notifyDiskSpaceLow('i-x', '99%', '90%')
    notifyHeartbeat('1.0.0')
    await new Promise(r => setTimeout(r, 30))
    expect(fetch).not.toHaveBeenCalled()
  })
})
