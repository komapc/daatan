/**
 * @jest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Session mock ─────────────────────────────────────────────────────────────
const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}))

vi.mock('next-auth/next', () => ({ getServerSession: mockGetServerSession }))
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))

// ─── Auth options mock ────────────────────────────────────────────────────────
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

// ─── Logger mock ──────────────────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

// ─── Prisma mock ──────────────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    botConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    botRunLog: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    prediction: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// ─── LLM mock ─────────────────────────────────────────────────────────────────
const mockGenerateContent = vi.fn()
vi.mock('@/lib/llm', () => ({
  createBotLLMService: vi.fn(() => ({ generateContent: mockGenerateContent })),
}))

// ─── Bot runner mock ──────────────────────────────────────────────────────────
vi.mock('@/lib/services/bot-runner', () => ({
  runBotById: vi.fn(),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_SESSION = {
  user: {
    id: 'admin-1',
    email: 'admin@daatan.test',
    role: 'ADMIN',
    rs: 100,
    cuAvailable: 1000,
    cuLocked: 0,
  },
}

const USER_SESSION = {
  user: {
    id: 'user-1',
    email: 'user@daatan.test',
    role: 'USER',
    rs: 10,
    cuAvailable: 100,
    cuLocked: 0,
  },
}

function makeBotRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'bot-1',
    userId: 'user-bot-1',
    isActive: true,
    intervalMinutes: 60,
    maxForecastsPerDay: 5,
    maxVotesPerDay: 10,
    stakeMin: 10,
    stakeMax: 50,
    modelPreference: 'google/gemini-2.0-flash-exp:free',
    hotnessMinSources: 2,
    hotnessWindowHours: 24,
    personaPrompt: 'You are a curious analyst.',
    forecastPrompt: 'Generate a forecast.',
    votePrompt: 'Decide whether to vote.',
    newsSources: ['https://feed.example.com/rss'],
    activeHoursStart: null,
    activeHoursEnd: null,
    tagFilter: [],
    voteBias: 50,
    cuRefillAt: 0,
    cuRefillAmount: 50,
    canCreateForecasts: true,
    canVote: true,
    autoApprove: false,
    lastRunAt: null,
    createdAt: new Date('2026-02-20T00:00:00Z'),
    user: { id: 'user-bot-1', name: 'TestBot', username: 'testbot_b', image: null, cuAvailable: 100, cuLocked: 0 },
    runLogs: [],
    ...overrides,
  }
}

// ─── GET /api/admin/bots ──────────────────────────────────────────────────────

describe('GET /api/admin/bots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/admin/bots/route')
    mockGetServerSession.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/admin/bots')
    const res = await GET(req, { params: {} })

    expect(res.status).toBe(401)
  })

  it('returns 403 when authenticated as non-admin', async () => {
    const { GET } = await import('@/app/api/admin/bots/route')
    mockGetServerSession.mockResolvedValue(USER_SESSION)

    const req = new NextRequest('http://localhost/api/admin/bots')
    const res = await GET(req, { params: {} })

    expect(res.status).toBe(403)
  })

  it('returns enriched bot list with forecastsToday, votesToday, and nextRunAt', async () => {
    const { GET } = await import('@/app/api/admin/bots/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    const lastRunAt = new Date('2026-02-20T10:00:00Z')
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([
      makeBotRecord({ lastRunAt, intervalMinutes: 60 }),
    ] as any)
    vi.mocked(prisma.botRunLog.count)
      .mockResolvedValueOnce(3) // forecastsToday
      .mockResolvedValueOnce(7) // votesToday

    const req = new NextRequest('http://localhost/api/admin/bots')
    const res = await GET(req, { params: {} })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.bots).toHaveLength(1)
    expect(data.bots[0].forecastsToday).toBe(3)
    expect(data.bots[0].votesToday).toBe(7)
    // nextRunAt = lastRunAt + intervalMinutes
    const expectedNextRunAt = new Date(lastRunAt.getTime() + 60 * 60 * 1000)
    expect(new Date(data.bots[0].nextRunAt).getTime()).toBe(expectedNextRunAt.getTime())
  })

  it('returns nextRunAt=null when lastRunAt is null', async () => {
    const { GET } = await import('@/app/api/admin/bots/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([makeBotRecord({ lastRunAt: null })] as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)

    const req = new NextRequest('http://localhost/api/admin/bots')
    const res = await GET(req, { params: {} })
    const data = await res.json()

    expect(data.bots[0].nextRunAt).toBeNull()
  })

  it('returns 500 on database error', async () => {
    const { GET } = await import('@/app/api/admin/bots/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findMany).mockRejectedValue(new Error('DB error'))

    const req = new NextRequest('http://localhost/api/admin/bots')
    const res = await GET(req, { params: {} })

    expect(res.status).toBe(500)
  })
})

// ─── POST /api/admin/bots ─────────────────────────────────────────────────────

describe('POST /api/admin/bots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('@/app/api/admin/bots/route')
    mockGetServerSession.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/admin/bots', {
      method: 'POST',
      body: JSON.stringify({ name: 'TestBot' }),
    })
    const res = await POST(req, { params: {} })

    expect(res.status).toBe(401)
  })

  it('returns 400 when stakeMin > stakeMax', async () => {
    const { POST } = await import('@/app/api/admin/bots/route')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    const req = new NextRequest('http://localhost/api/admin/bots', {
      method: 'POST',
      body: JSON.stringify({
        name: 'TestBot',
        personaPrompt: 'Custom persona prompt, long enough to pass validation.',
        forecastPrompt: 'Custom forecast prompt, long enough to pass validation.',
        votePrompt: 'Custom vote prompt, long enough to pass validation.',
        stakeMin: 100,
        stakeMax: 10,
      }),
    })
    const res = await POST(req, { params: {} })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/stakeMin/)
  })

  it('returns 400 when username is already taken', async () => {
    const { POST } = await import('@/app/api/admin/bots/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing-user' } as any)

    const req = new NextRequest('http://localhost/api/admin/bots', {
      method: 'POST',
      body: JSON.stringify({
        name: 'TestBot',
        personaPrompt: 'Custom persona prompt, long enough to pass validation.',
        forecastPrompt: 'Custom forecast prompt, long enough to pass validation.',
        votePrompt: 'Custom vote prompt, long enough to pass validation.',
      }),
    })
    const res = await POST(req, { params: {} })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/taken/)
  })

  it('returns 201 and creates bot when request is valid', async () => {
    const { POST } = await import('@/app/api/admin/bots/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(null) // username is available

    const createdBot = {
      id: 'new-bot-id',
      userId: 'new-user-id',
      user: { id: 'new-user-id', name: 'NewBot', username: 'newbot_b' },
    }
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const tx = {
        user: { create: vi.fn().mockResolvedValue({ id: 'new-user-id', name: 'NewBot', username: 'newbot_b' }) },
        botConfig: { create: vi.fn().mockResolvedValue(createdBot) },
      }
      return fn(tx)
    })

    const req = new NextRequest('http://localhost/api/admin/bots', {
      method: 'POST',
      body: JSON.stringify({
        name: 'NewBot',
        personaPrompt: 'Custom persona prompt, long enough to pass validation.',
        forecastPrompt: 'Custom forecast prompt, long enough to pass validation.',
        votePrompt: 'Custom vote prompt, long enough to pass validation.',
        stakeMin: 10,
        stakeMax: 100,
      }),
    })
    const res = await POST(req, { params: {} })
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.bot).toBeDefined()
    expect(data.bot.id).toBe('new-bot-id')
  })

  it('returns 400 when schema validation fails (name too short)', async () => {
    const { POST } = await import('@/app/api/admin/bots/route')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    const req = new NextRequest('http://localhost/api/admin/bots', {
      method: 'POST',
      body: JSON.stringify({ name: 'X' }), // name min length is 2
    })
    const res = await POST(req, { params: {} })

    expect(res.status).toBe(400)
  })
})

// ─── PATCH /api/admin/bots/[id] ──────────────────────────────────────────────

describe('PATCH /api/admin/bots/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { PATCH } = await import('@/app/api/admin/bots/[id]/route')
    mockGetServerSession.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    })
    const res = await PATCH(req, { params: { id: 'bot-1' } })

    expect(res.status).toBe(401)
  })

  it('returns 404 when bot does not exist', async () => {
    const { PATCH } = await import('@/app/api/admin/bots/[id]/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/admin/bots/nonexistent', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    })
    const res = await PATCH(req, { params: { id: 'nonexistent' } })

    expect(res.status).toBe(404)
  })

  it('returns 400 when updated stakeMin would exceed stakeMax', async () => {
    const { PATCH } = await import('@/app/api/admin/bots/[id]/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(makeBotRecord({ stakeMin: 10, stakeMax: 50 }) as any)

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1', {
      method: 'PATCH',
      body: JSON.stringify({ stakeMin: 200 }), // 200 > stakeMax(50)
    })
    const res = await PATCH(req, { params: { id: 'bot-1' } })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/stakeMin/)
  })

  it('returns 200 with updated bot on valid update', async () => {
    const { PATCH } = await import('@/app/api/admin/bots/[id]/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    const existing = makeBotRecord()
    const updated = { ...existing, isActive: false, user: { id: 'user-bot-1', name: 'TestBot', username: 'testbot_b', cuAvailable: 100 } }
    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(existing as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue(updated as any)

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    })
    const res = await PATCH(req, { params: { id: 'bot-1' } })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.bot.isActive).toBe(false)
  })
})

// ─── DELETE /api/admin/bots/[id] ─────────────────────────────────────────────

describe('DELETE /api/admin/bots/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { DELETE } = await import('@/app/api/admin/bots/[id]/route')
    mockGetServerSession.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: { id: 'bot-1' } })

    expect(res.status).toBe(401)
  })

  it('returns 404 when bot does not exist', async () => {
    const { DELETE } = await import('@/app/api/admin/bots/[id]/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/admin/bots/nonexistent', { method: 'DELETE' })
    const res = await DELETE(req, { params: { id: 'nonexistent' } })

    expect(res.status).toBe(404)
  })

  it('soft-deletes the bot (sets isActive=false) and returns ok', async () => {
    const { DELETE } = await import('@/app/api/admin/bots/[id]/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(makeBotRecord() as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: { id: 'bot-1' } })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(prisma.botConfig.update).toHaveBeenCalledWith({
      where: { id: 'bot-1' },
      data: { isActive: false },
    })
  })
})

// ─── GET /api/admin/bots/[id]/logs ───────────────────────────────────────────

describe('GET /api/admin/bots/[id]/logs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/admin/bots/[id]/logs/route')
    mockGetServerSession.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1/logs')
    const res = await GET(req, { params: { id: 'bot-1' } })

    expect(res.status).toBe(401)
  })

  it('returns 404 when bot does not exist', async () => {
    const { GET } = await import('@/app/api/admin/bots/[id]/logs/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/admin/bots/nonexistent/logs')
    const res = await GET(req, { params: { id: 'nonexistent' } })

    expect(res.status).toBe(404)
  })

  it('returns paginated logs with correct pagination metadata', async () => {
    const { GET } = await import('@/app/api/admin/bots/[id]/logs/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(makeBotRecord() as any)

    const sampleLogs = Array.from({ length: 20 }, (_, i) => ({
      id: `log-${i}`,
      botId: 'bot-1',
      action: 'CREATED_FORECAST',
      runAt: new Date(),
      isDryRun: false,
      error: null,
      generatedText: null,
      forecastId: null,
      triggerNews: null,
    }))
    vi.mocked(prisma.botRunLog.findMany).mockResolvedValue(sampleLogs as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(45)

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1/logs?page=2&limit=20')
    const res = await GET(req, { params: { id: 'bot-1' } })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.logs).toHaveLength(20)
    expect(data.pagination.page).toBe(2)
    expect(data.pagination.limit).toBe(20)
    expect(data.pagination.total).toBe(45)
    expect(data.pagination.totalPages).toBe(3) // ceil(45/20)
  })

  it('clamps limit to maximum of 50', async () => {
    const { GET } = await import('@/app/api/admin/bots/[id]/logs/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(makeBotRecord() as any)
    vi.mocked(prisma.botRunLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1/logs?limit=999')
    const res = await GET(req, { params: { id: 'bot-1' } })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.pagination.limit).toBe(50) // clamped
  })

  it('defaults to page=1 and limit=20', async () => {
    const { GET } = await import('@/app/api/admin/bots/[id]/logs/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(makeBotRecord() as any)
    vi.mocked(prisma.botRunLog.findMany).mockResolvedValue([])
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1/logs')
    const res = await GET(req, { params: { id: 'bot-1' } })
    const data = await res.json()

    expect(data.pagination.page).toBe(1)
    expect(data.pagination.limit).toBe(20)
  })
})

// ─── POST /api/admin/bots/[id]/run ───────────────────────────────────────────

describe('POST /api/admin/bots/[id]/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    const { POST } = await import('@/app/api/admin/bots/[id]/run/route')
    mockGetServerSession.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1/run', { method: 'POST' })
    const res = await POST(req, { params: { id: 'bot-1' } })

    expect(res.status).toBe(401)
  })

  it('returns 404 when bot does not exist', async () => {
    const { POST } = await import('@/app/api/admin/bots/[id]/run/route')
    const { prisma } = await import('@/lib/prisma')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/admin/bots/nonexistent/run', { method: 'POST' })
    const res = await POST(req, { params: { id: 'nonexistent' } })

    expect(res.status).toBe(404)
  })

  it('triggers runBotById with dryRun=false when ?dry param is absent', async () => {
    const { POST } = await import('@/app/api/admin/bots/[id]/run/route')
    const { prisma } = await import('@/lib/prisma')
    const { runBotById } = await import('@/lib/services/bot-runner')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(makeBotRecord() as any)
    vi.mocked(runBotById).mockResolvedValue({
      botId: 'bot-1', botName: 'TestBot', forecastsCreated: 1, votes: 0, skipped: 0, errors: 0, dryRun: false,
    })

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1/run', { method: 'POST' })
    const res = await POST(req, { params: { id: 'bot-1' } })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(runBotById).toHaveBeenCalledWith('bot-1', false)
  })

  it('triggers runBotById with dryRun=true when ?dry=true', async () => {
    const { POST } = await import('@/app/api/admin/bots/[id]/run/route')
    const { prisma } = await import('@/lib/prisma')
    const { runBotById } = await import('@/lib/services/bot-runner')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(makeBotRecord() as any)
    vi.mocked(runBotById).mockResolvedValue({
      botId: 'bot-1', botName: 'TestBot', forecastsCreated: 0, votes: 0, skipped: 0, errors: 0, dryRun: true,
    })

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1/run?dry=true', { method: 'POST' })
    const res = await POST(req, { params: { id: 'bot-1' } })

    expect(res.status).toBe(200)
    expect(runBotById).toHaveBeenCalledWith('bot-1', true)
  })

  it('returns summary from runBotById in response', async () => {
    const { POST } = await import('@/app/api/admin/bots/[id]/run/route')
    const { prisma } = await import('@/lib/prisma')
    const { runBotById } = await import('@/lib/services/bot-runner')
    mockGetServerSession.mockResolvedValue(ADMIN_SESSION)

    const mockSummary = {
      botId: 'bot-1', botName: 'TestBot', forecastsCreated: 2, votes: 3, skipped: 0, errors: 0, dryRun: false,
    }
    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(makeBotRecord() as any)
    vi.mocked(runBotById).mockResolvedValue(mockSummary)

    const req = new NextRequest('http://localhost/api/admin/bots/bot-1/run', { method: 'POST' })
    const res = await POST(req, { params: { id: 'bot-1' } })
    const data = await res.json()

    expect(data.summary).toMatchObject({
      forecastsCreated: 2,
      votes: 3,
      dryRun: false,
    })
  })
})
