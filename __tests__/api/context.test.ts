import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/forecasts/[id]/context/route'

const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}))

vi.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}))

const { mockSearchArticles, mockGenerateContent, mockPrisma } = vi.hoisted(() => ({
  mockSearchArticles: vi.fn(),
  mockGenerateContent: vi.fn(),
  mockPrisma: {
    prediction: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    contextSnapshot: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/utils/webSearch', () => ({
  searchArticles: (...args: unknown[]) => mockSearchArticles(...args),
}))

vi.mock('@/lib/llm', () => ({
  llmService: {
    generateContent: (...args: unknown[]) => mockGenerateContent(...args),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

const makeRequest = (id: string, method = 'GET') =>
  new NextRequest(`http://localhost/api/forecasts/${id}/context`, { method })

const routeParams = (id: string) => ({ params: { id } })

describe('GET /api/forecasts/[id]/context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when prediction not found', async () => {
    mockPrisma.prediction.findUnique.mockResolvedValue(null)

    const res = await GET(makeRequest('missing'), routeParams('missing'))
    expect(res.status).toBe(404)
  })

  it('returns context timeline', async () => {
    const snapshots = [
      { id: 's1', summary: 'Latest update', sources: [{ title: 'Reuters', url: 'https://r.com' }], createdAt: new Date() },
      { id: 's2', summary: 'Older update', sources: [], createdAt: new Date(Date.now() - 86400000) },
    ]

    mockPrisma.prediction.findUnique.mockResolvedValue({
      id: 'pred1',
      detailsText: 'Latest update',
      contextUpdatedAt: new Date(),
      contextSnapshots: snapshots,
    })

    const res = await GET(makeRequest('pred1'), routeParams('pred1'))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.currentContext).toBe('Latest update')
    expect(data.snapshots).toHaveLength(2)
    expect(data.contextUpdatedAt).toBeDefined()
  })
})

describe('POST /api/forecasts/[id]/context', () => {
  const authenticatedUser = {
    id: 'user1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    rs: 100,
    cuAvailable: 100,
    cuLocked: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const res = await POST(makeRequest('pred1', 'POST'), routeParams('pred1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when prediction not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: authenticatedUser })
    mockPrisma.prediction.findUnique.mockResolvedValue(null)

    const res = await POST(makeRequest('missing', 'POST'), routeParams('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 403 when user is not author or admin', async () => {
    mockGetServerSession.mockResolvedValue({ user: authenticatedUser })
    mockPrisma.prediction.findUnique.mockResolvedValue({
      id: 'pred1',
      authorId: 'other-user',
      status: 'ACTIVE',
      contextUpdatedAt: null,
    })

    const res = await POST(makeRequest('pred1', 'POST'), routeParams('pred1'))
    expect(res.status).toBe(403)
  })

  it('returns 400 when prediction is not ACTIVE', async () => {
    mockGetServerSession.mockResolvedValue({ user: authenticatedUser })
    mockPrisma.prediction.findUnique.mockResolvedValue({
      id: 'pred1',
      authorId: 'user1',
      status: 'RESOLVED_CORRECT',
      contextUpdatedAt: null,
    })

    const res = await POST(makeRequest('pred1', 'POST'), routeParams('pred1'))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited (updated within 24h)', async () => {
    mockGetServerSession.mockResolvedValue({ user: authenticatedUser })
    mockPrisma.prediction.findUnique.mockResolvedValue({
      id: 'pred1',
      authorId: 'user1',
      status: 'ACTIVE',
      contextUpdatedAt: new Date(), // just now
    })

    const res = await POST(makeRequest('pred1', 'POST'), routeParams('pred1'))
    expect(res.status).toBe(429)
  })

  it('returns 404 when no articles found', async () => {
    mockGetServerSession.mockResolvedValue({ user: authenticatedUser })
    mockPrisma.prediction.findUnique.mockResolvedValue({
      id: 'pred1',
      authorId: 'user1',
      status: 'ACTIVE',
      claimText: 'Test claim',
      contextUpdatedAt: null,
      newsAnchor: null,
    })
    mockSearchArticles.mockResolvedValue([])

    const res = await POST(makeRequest('pred1', 'POST'), routeParams('pred1'))
    expect(res.status).toBe(404)
  })

  it('creates snapshot and updates prediction on success', async () => {
    mockGetServerSession.mockResolvedValue({ user: authenticatedUser })
    mockPrisma.prediction.findUnique.mockResolvedValue({
      id: 'pred1',
      authorId: 'user1',
      status: 'ACTIVE',
      claimText: 'Bitcoin will reach $100k',
      detailsText: 'Old context',
      contextUpdatedAt: null,
      newsAnchor: { title: 'Bitcoin Rally' },
    })

    mockSearchArticles.mockResolvedValue([
      { title: 'Bitcoin at 95k', url: 'https://example.com/1', source: 'Reuters', publishedDate: '2026-02-20', snippet: 'Bitcoin surges.' },
    ])

    const snapshot = { id: 'snap1', summary: 'New context summary', sources: [{ title: 'Bitcoin at 95k', url: 'https://example.com/1', source: 'Reuters', publishedDate: '2026-02-20' }], createdAt: new Date() }
    mockGenerateContent.mockResolvedValue({ text: ' New context summary ' })
    mockPrisma.$transaction.mockResolvedValue([snapshot, {}])
    mockPrisma.contextSnapshot.findMany.mockResolvedValue([snapshot])

    const res = await POST(makeRequest('pred1', 'POST'), routeParams('pred1'))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.newContext).toBe('New context summary')
    expect(data.snapshot.id).toBe('snap1')
    expect(data.timeline).toHaveLength(1)

    // Verify transaction was called
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)

    // Verify search used newsAnchor title
    expect(mockSearchArticles).toHaveBeenCalledWith('Bitcoin Rally', 4)
  })

  it('passes previousContext to LLM prompt when detailsText exists', async () => {
    mockGetServerSession.mockResolvedValue({ user: authenticatedUser })
    mockPrisma.prediction.findUnique.mockResolvedValue({
      id: 'pred1',
      authorId: 'user1',
      status: 'ACTIVE',
      claimText: 'Test claim',
      detailsText: 'Previous context here',
      contextUpdatedAt: null,
      newsAnchor: null,
    })

    mockSearchArticles.mockResolvedValue([
      { title: 'News', url: 'https://example.com', source: 'BBC', publishedDate: '2026-02-20', snippet: 'Something happened.' },
    ])

    mockGenerateContent.mockResolvedValue({ text: 'Updated context' })
    mockPrisma.$transaction.mockResolvedValue([{ id: 'snap1', summary: 'Updated context', sources: [], createdAt: new Date() }, {}])
    mockPrisma.contextSnapshot.findMany.mockResolvedValue([])

    await POST(makeRequest('pred1', 'POST'), routeParams('pred1'))

    // Verify LLM was called with a prompt containing previous context
    const llmCall = mockGenerateContent.mock.calls[0][0]
    expect(llmCall.prompt).toContain('Previous context here')
    expect(llmCall.prompt).toContain('CHANGED')
  })

  it('allows ADMIN to update context for other user predictions', async () => {
    const adminUser = { ...authenticatedUser, id: 'admin1', role: 'ADMIN' }
    mockGetServerSession.mockResolvedValue({ user: adminUser })
    mockPrisma.prediction.findUnique.mockResolvedValue({
      id: 'pred1',
      authorId: 'other-user',
      status: 'ACTIVE',
      claimText: 'Test',
      detailsText: null,
      contextUpdatedAt: null,
      newsAnchor: null,
    })

    mockSearchArticles.mockResolvedValue([
      { title: 'News', url: 'https://example.com', source: 'BBC', publishedDate: '2026-02-20', snippet: 'News.' },
    ])

    mockGenerateContent.mockResolvedValue({ text: 'Context' })
    mockPrisma.$transaction.mockResolvedValue([{ id: 'snap1', summary: 'Context', sources: [], createdAt: new Date() }, {}])
    mockPrisma.contextSnapshot.findMany.mockResolvedValue([])

    const res = await POST(makeRequest('pred1', 'POST'), routeParams('pred1'))
    expect(res.status).toBe(200)
  })
})
