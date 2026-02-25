import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/profile/language/route'

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}))

vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('next-auth/next', () => ({ getServerSession: mockGetServerSession }))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}))

describe('PATCH /api/profile/language', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/profile/language', {
      method: 'PATCH',
      body: JSON.stringify({ language: 'en' }),
    })
    const response = await PATCH(request, { params: {} } as any)

    expect(response.status).toBe(401)
  })

  it('updates preferred language to English', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com', role: 'USER' },
    })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user1', preferredLanguage: 'en' } as any)

    const request = new NextRequest('http://localhost/api/profile/language', {
      method: 'PATCH',
      body: JSON.stringify({ language: 'en' }),
    })
    const response = await PATCH(request, { params: {} } as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.language).toBe('en')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { preferredLanguage: 'en' },
    })
  })

  it('updates preferred language to Hebrew', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com', role: 'USER' },
    })

    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user1', preferredLanguage: 'he' } as any)

    const request = new NextRequest('http://localhost/api/profile/language', {
      method: 'PATCH',
      body: JSON.stringify({ language: 'he' }),
    })
    const response = await PATCH(request, { params: {} } as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.language).toBe('he')
  })

  it('rejects invalid language values with Zod error', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com', role: 'USER' },
    })

    const request = new NextRequest('http://localhost/api/profile/language', {
      method: 'PATCH',
      body: JSON.stringify({ language: 'fr' }),
    })
    const response = await PATCH(request, { params: {} } as any)

    // Zod validation should throw and be caught by withAuth / error handler
    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects missing language field', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com', role: 'USER' },
    })

    const request = new NextRequest('http://localhost/api/profile/language', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    const response = await PATCH(request, { params: {} } as any)

    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})
