/**
 * @jest-environment node
 */
import { GET } from '@/app/api/notifications/unread-count/route'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }))

vi.mock('@/auth', () => ({ auth: mockAuth }))

vi.mock('@/lib/services/notification', () => ({
  getUnreadCount: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60000 }),
  rateLimitResponse: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), { status: 429 }),
  ),
}))

describe('GET /api/notifications/unread-count', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60000 })
  })

  it('returns count 0 when not authenticated (no rate-limit check)', async () => {
    mockAuth.mockResolvedValue(null)
    const { checkRateLimit } = await import('@/lib/rate-limit')

    const response = await GET()
    const data = await response.json()

    expect(data).toEqual({ count: 0 })
    expect(checkRateLimit).not.toHaveBeenCalled()
  })

  it('returns the unread count for an authenticated user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    const { getUnreadCount } = await import('@/lib/services/notification')
    vi.mocked(getUnreadCount).mockResolvedValue(7)

    const response = await GET()
    const data = await response.json()

    expect(data).toEqual({ count: 7 })
    expect(getUnreadCount).toHaveBeenCalledWith('user-1')
  })

  it('rate-limits per user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 })

    const response = await GET()

    expect(response.status).toBe(429)
    expect(checkRateLimit).toHaveBeenCalledWith('unread-count:user-1', 120, 60 * 1000)
  })

  it('returns count 0 on service error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    const { getUnreadCount } = await import('@/lib/services/notification')
    vi.mocked(getUnreadCount).mockRejectedValue(new Error('DB error'))

    const response = await GET()
    const data = await response.json()

    expect(data).toEqual({ count: 0 })
  })
})
