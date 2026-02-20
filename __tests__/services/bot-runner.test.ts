import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Prisma mock ─────────────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    botConfig: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    prediction: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    botRunLog: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

// ─── LLM mock ────────────────────────────────────────────────────────────────
const mockGenerateContent = vi.fn()
vi.mock('@/lib/llm', () => ({
  createBotLLMService: vi.fn(() => ({ generateContent: mockGenerateContent })),
}))

// ─── RSS mock ────────────────────────────────────────────────────────────────
vi.mock('@/lib/services/rss', () => ({
  fetchRssFeeds: vi.fn(),
  detectHotTopics: vi.fn(),
}))

// ─── Commitment mock ─────────────────────────────────────────────────────────
vi.mock('@/lib/services/commitment', () => ({
  createCommitment: vi.fn(),
}))

// ─── Logger mock ─────────────────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a minimal bot fixture. `lastRunAt` defaults to null (never run). */
function makeBot(overrides: Partial<{
  id: string
  userId: string
  isActive: boolean
  intervalMinutes: number
  lastRunAt: Date | null
  maxForecastsPerDay: number
  maxVotesPerDay: number
  newsSources: string[]
  hotnessMinSources: number
  hotnessWindowHours: number
  modelPreference: string
  stakeMin: number
  stakeMax: number
  personaPrompt: string
  forecastPrompt: string
  votePrompt: string
  user: { id: string; name: string | null; cuAvailable: number }
}> = {}) {
  return {
    id: 'bot-1',
    userId: 'user-1',
    isActive: true,
    intervalMinutes: 60,
    lastRunAt: null,
    maxForecastsPerDay: 5,
    maxVotesPerDay: 10,
    newsSources: ['https://feed.example.com/rss'],
    hotnessMinSources: 2,
    hotnessWindowHours: 24,
    modelPreference: 'gpt-4o-mini',
    stakeMin: 10,
    stakeMax: 50,
    personaPrompt: 'You are a forecasting bot.',
    forecastPrompt: 'Generate a forecast.',
    votePrompt: 'Should you vote?',
    user: { id: 'user-1', name: 'BotUser', cuAvailable: 1000 },
    ...overrides,
  }
}

/** Valid forecast JSON the LLM returns when asked to create a forecast. */
const VALID_FORECAST_JSON = JSON.stringify({
  claimText: '🤖 Bitcoin will exceed $100k by end of Q3',
  detailsText: 'Based on recent trends.',
  outcomeType: 'BINARY',
  resolveByDatetime: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  resolutionRules: 'Check CMC price on resolution date.',
  tags: ['crypto', 'bitcoin'],
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('runDueBots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-20T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs a bot that has never run before (lastRunAt = null)', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ lastRunAt: null, maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([bot] as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    const summaries = await runDueBots()

    expect(summaries).toHaveLength(1)
    expect(summaries[0].botId).toBe('bot-1')
  })

  it('skips a bot whose interval has not elapsed yet', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    // lastRunAt = 30 minutes ago, interval = 60 min → not due yet
    const lastRunAt = new Date(Date.now() - 30 * 60 * 1000)
    const bot = makeBot({ lastRunAt, intervalMinutes: 60 })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([bot] as any)

    const summaries = await runDueBots()

    expect(summaries).toHaveLength(0)
  })

  it('runs a bot whose interval has exactly elapsed', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    // lastRunAt = exactly 60 minutes ago, interval = 60 min → due (nextRunAt === now)
    const lastRunAt = new Date(Date.now() - 60 * 60 * 1000)
    const bot = makeBot({ lastRunAt, intervalMinutes: 60, maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([bot] as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    const summaries = await runDueBots()

    expect(summaries).toHaveLength(1)
  })

  it('runs a bot that is overdue (last run longer ago than interval)', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    // lastRunAt = 3 hours ago, interval = 60 min → overdue
    const lastRunAt = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const bot = makeBot({ lastRunAt, intervalMinutes: 60, maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([bot] as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    const summaries = await runDueBots()

    expect(summaries).toHaveLength(1)
  })

  it('processes multiple bots independently — runs due ones, skips not-due ones', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    const dueBbot = makeBot({
      id: 'bot-due',
      lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 h ago, interval=60 → due
      intervalMinutes: 60,
      maxVotesPerDay: 0,
    })
    const notDueBot = makeBot({
      id: 'bot-not-due',
      lastRunAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago, interval=60 → not due
      intervalMinutes: 60,
    })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([dueBbot, notDueBot] as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    const summaries = await runDueBots()

    expect(summaries).toHaveLength(1)
    expect(summaries[0].botId).toBe('bot-due')
  })

  it('updates lastRunAt after running a bot (non-dry-run)', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([bot] as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    await runDueBots(false)

    expect(prisma.botConfig.update).toHaveBeenCalledWith({
      where: { id: 'bot-1' },
      data: { lastRunAt: expect.any(Date) },
    })
  })

  it('does not update lastRunAt in dry-run mode', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([bot] as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)

    await runDueBots(true)

    expect(prisma.botConfig.update).not.toHaveBeenCalled()
  })

  it('returns empty array when there are no active bots', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([])

    const summaries = await runDueBots()

    expect(summaries).toEqual([])
  })
})

describe('runDueBots — maxForecastsPerDay cap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-20T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('skips forecast creation when daily cap is already reached', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ maxForecastsPerDay: 3, maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([bot] as any)

    // Already at cap: count returns 3 for CREATED_FORECAST, 0 for VOTED
    vi.mocked(prisma.botRunLog.count).mockImplementation(({ where }: any) => {
      if (where.action === 'CREATED_FORECAST') return Promise.resolve(3) as any
      return Promise.resolve(0) as any
    })
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    await runDueBots()

    // fetchRssFeeds should not be called because there are no slots left
    expect(fetchRssFeeds).not.toHaveBeenCalled()
    expect(detectHotTopics).not.toHaveBeenCalled()
  })

  it('creates up to the remaining forecast slots only', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runDueBots } = await import('@/lib/services/bot-runner')
    const { createCommitment } = await import('@/lib/services/commitment')

    const bot = makeBot({ maxForecastsPerDay: 3, maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([bot] as any)

    // 2 forecasts already created today → 1 slot left
    vi.mocked(prisma.botRunLog.count).mockImplementation(({ where }: any) => {
      if (where.action === 'CREATED_FORECAST') return Promise.resolve(2) as any
      return Promise.resolve(0) as any
    })

    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    // Return 3 hot topics, but only 1 slot left → only 1 should be processed
    vi.mocked(detectHotTopics).mockReturnValue([
      { title: 'Topic A', items: [], sourceCount: 3 },
      { title: 'Topic B', items: [], sourceCount: 2 },
      { title: 'Topic C', items: [], sourceCount: 2 },
    ] as any)

    // LLM: dedup check → "no" (topic not already covered); forecast generation returns valid JSON
    mockGenerateContent
      .mockResolvedValueOnce({ text: 'no' }) // dedup check for topic A
      .mockResolvedValueOnce({ text: VALID_FORECAST_JSON }) // forecast generation for topic A

    vi.mocked(prisma.prediction.findMany).mockResolvedValue([])
    vi.mocked(prisma.prediction.create).mockResolvedValue({ id: 'pred-new' } as any)
    vi.mocked(prisma.prediction.update).mockResolvedValue({} as any)
    vi.mocked(createCommitment).mockResolvedValue({ ok: true } as any)
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    const summaries = await runDueBots()

    // Only 1 forecast should have been created (1 slot remaining)
    expect(summaries[0].forecastsCreated).toBe(1)
    // LLM should have been called exactly twice: once for dedup, once for generation
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
  })

  it('increments forecastsCreated in summary for each successfully created forecast', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runDueBots } = await import('@/lib/services/bot-runner')
    const { createCommitment } = await import('@/lib/services/commitment')

    const bot = makeBot({ maxForecastsPerDay: 5, maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([bot] as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([
      { title: 'Topic A', items: [], sourceCount: 3 },
      { title: 'Topic B', items: [], sourceCount: 2 },
    ] as any)

    // Both topics: dedup → "no", then generate valid JSON
    mockGenerateContent
      .mockResolvedValueOnce({ text: 'no' })
      .mockResolvedValueOnce({ text: VALID_FORECAST_JSON })
      .mockResolvedValueOnce({ text: 'no' })
      .mockResolvedValueOnce({ text: VALID_FORECAST_JSON })

    vi.mocked(prisma.prediction.findMany).mockResolvedValue([])
    vi.mocked(prisma.prediction.create).mockResolvedValue({ id: 'pred-x' } as any)
    vi.mocked(prisma.prediction.update).mockResolvedValue({} as any)
    vi.mocked(createCommitment).mockResolvedValue({ ok: true } as any)
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    const summaries = await runDueBots()

    expect(summaries[0].forecastsCreated).toBe(2)
  })

  it('increments skipped when dedup check says topic already covered', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ maxForecastsPerDay: 5, maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([bot] as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([
      { title: 'Bitcoin topic already exists', items: [], sourceCount: 3 },
    ] as any)

    // LLM dedup check → "yes" (already exists)
    mockGenerateContent.mockResolvedValueOnce({ text: 'yes, it already exists' })

    vi.mocked(prisma.prediction.findMany).mockResolvedValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    const summaries = await runDueBots()

    expect(summaries[0].skipped).toBe(1)
    expect(summaries[0].forecastsCreated).toBe(0)
  })

  it('increments skipped when there are no hot topics', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runDueBots } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findMany).mockResolvedValue([bot] as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    const summaries = await runDueBots()

    expect(summaries[0].skipped).toBeGreaterThanOrEqual(1)
    expect(summaries[0].forecastsCreated).toBe(0)
  })
})

describe('runBotById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-20T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws when the bot is not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { runBotById } = await import('@/lib/services/bot-runner')

    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(null)

    await expect(runBotById('nonexistent-bot')).rejects.toThrow('Bot not found: nonexistent-bot')
  })

  it('returns a summary with the correct botId', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runBotById } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ id: 'specific-bot', maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(bot as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    const summary = await runBotById('specific-bot')

    expect(summary.botId).toBe('specific-bot')
  })

  it('updates lastRunAt after running (non-dry-run)', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runBotById } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(bot as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    await runBotById('bot-1', false)

    expect(prisma.botConfig.update).toHaveBeenCalledWith({
      where: { id: 'bot-1' },
      data: { lastRunAt: expect.any(Date) },
    })
  })

  it('does not update lastRunAt in dry-run mode', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runBotById } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(bot as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)

    await runBotById('bot-1', true)

    expect(prisma.botConfig.update).not.toHaveBeenCalled()
  })

  it('sets dryRun flag correctly in returned summary', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { runBotById } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(bot as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)

    const dryRunSummary = await runBotById('bot-1', true)
    expect(dryRunSummary.dryRun).toBe(true)
  })

  it('does not call fetchRssFeeds when newsSources is empty', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds } = await import('@/lib/services/rss')
    const { runBotById } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ newsSources: [], maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(bot as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(prisma.botConfig.update).mockResolvedValue({} as any)

    await runBotById('bot-1')

    expect(fetchRssFeeds).not.toHaveBeenCalled()
  })

  it('in dry-run mode creates a log entry but does not call createCommitment', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { fetchRssFeeds, detectHotTopics } = await import('@/lib/services/rss')
    const { createCommitment } = await import('@/lib/services/commitment')
    const { runBotById } = await import('@/lib/services/bot-runner')

    const bot = makeBot({ maxVotesPerDay: 0 })
    vi.mocked(prisma.botConfig.findUnique).mockResolvedValue(bot as any)
    vi.mocked(prisma.botRunLog.count).mockResolvedValue(0)
    vi.mocked(fetchRssFeeds).mockResolvedValue([])
    vi.mocked(detectHotTopics).mockReturnValue([
      { title: 'Dry run topic about bitcoin price', items: [], sourceCount: 3 },
    ] as any)

    mockGenerateContent
      .mockResolvedValueOnce({ text: 'no' }) // dedup
      .mockResolvedValueOnce({ text: VALID_FORECAST_JSON }) // generation

    vi.mocked(prisma.prediction.findMany).mockResolvedValue([])
    vi.mocked(prisma.botRunLog.create).mockResolvedValue({} as any)

    const summary = await runBotById('bot-1', true)

    expect(createCommitment).not.toHaveBeenCalled()
    expect(summary.forecastsCreated).toBe(1)
    expect(summary.dryRun).toBe(true)
  })
})
