/**
 * @jest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Logger mock ──────────────────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

// ─── Bot runner mock ──────────────────────────────────────────────────────────
vi.mock('@/lib/services/bot-runner', () => ({
  runDueBots: vi.fn(),
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/bots/run', () => {
  const VALID_SECRET = 'test-bot-runner-secret'

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BOT_RUNNER_SECRET = VALID_SECRET
  })

  it('returns 401 when x-bot-runner-secret header is missing', async () => {
    const { POST } = await import('@/app/api/bots/run/route')

    const req = new NextRequest('http://localhost/api/bots/run', { method: 'POST' })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 401 when x-bot-runner-secret header has a wrong value', async () => {
    const { POST } = await import('@/app/api/bots/run/route')

    const req = new NextRequest('http://localhost/api/bots/run', {
      method: 'POST',
      headers: { 'x-bot-runner-secret': 'wrong-secret' },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 401 when BOT_RUNNER_SECRET env var is not set', async () => {
    const { POST } = await import('@/app/api/bots/run/route')
    delete process.env.BOT_RUNNER_SECRET

    const req = new NextRequest('http://localhost/api/bots/run', {
      method: 'POST',
      headers: { 'x-bot-runner-secret': 'any-value' },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('calls runDueBots(false) and returns summaries when secret is correct', async () => {
    const { POST } = await import('@/app/api/bots/run/route')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    const mockSummaries = [
      { botId: 'bot-1', botName: 'TestBot', forecastsCreated: 1, votes: 2, skipped: 0, errors: 0, dryRun: false },
    ]
    vi.mocked(runDueBots).mockResolvedValue(mockSummaries)

    const req = new NextRequest('http://localhost/api/bots/run', {
      method: 'POST',
      headers: { 'x-bot-runner-secret': VALID_SECRET },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.summaries).toEqual(mockSummaries)
    expect(runDueBots).toHaveBeenCalledWith(false)
  })

  it('returns 500 and error message when runDueBots throws', async () => {
    const { POST } = await import('@/app/api/bots/run/route')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    vi.mocked(runDueBots).mockRejectedValue(new Error('Service unavailable'))

    const req = new NextRequest('http://localhost/api/bots/run', {
      method: 'POST',
      headers: { 'x-bot-runner-secret': VALID_SECRET },
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toContain('Service unavailable')
  })
})
