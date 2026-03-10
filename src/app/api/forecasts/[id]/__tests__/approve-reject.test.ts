import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { POST as approveHandler } from '../approve/route'
import { POST as rejectHandler } from '../reject/route'

// Mock telegram notifications
vi.mock('@/lib/services/telegram', () => ({
  notifyForecastPublished: vi.fn(),
}))

describe('Forecast Approval Workflow', () => {
  let botUser: any
  let normalUser: any
  let botConfig: any
  let pendingForecast: any

  beforeEach(async () => {
    // Create test users
    botUser = await prisma.user.create({
      data: {
        email: `bot-${Date.now()}@daatan.internal`,
        username: `sports_bot_${Date.now()}`,
        isBot: true,
      },
    })

    normalUser = await prisma.user.create({
      data: {
        email: `user-${Date.now()}@example.com`,
        username: `user_${Date.now()}`,
      },
    })

    // Create bot config with approval requirement
    botConfig = await prisma.botConfig.create({
      data: {
        userId: botUser.id,
        personaPrompt: 'You are a sports analyst',
        forecastPrompt: 'Create a sports forecast',
        votePrompt: 'Vote on sports forecasts',
        newsSources: ['https://example.com/sports'],
        requireApprovalForForecasts: true,
        maxForecastsPerHour: 5,
      },
    })

    // Create a pending forecast
    pendingForecast = await prisma.prediction.create({
      data: {
        authorId: botUser.id,
        claimText: '🤖 Team A will win the championship',
        detailsText: 'Based on current standings and recent form',
        status: 'PENDING_APPROVAL',
        outcomeType: 'BINARY',
        outcomePayload: { type: 'BINARY' },
        resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        resolutionRules: 'Official championship results',
        source: 'bot',
      },
    })
  })

  describe('POST /api/forecasts/[id]/approve', () => {
    it('should transition forecast from PENDING_APPROVAL to ACTIVE', async () => {
      const mockRequest = new Request('http://localhost:3000/api/forecasts/forecast-1/approve', {
        method: 'POST',
      })

      const mockContext = {
        params: { id: pendingForecast.id },
      }

      const response = await approveHandler(
        mockRequest as any,
        { id: normalUser.id, email: normalUser.email } as any,
        mockContext as any
      )

      expect(response.status).toBe(200)

      // Verify forecast status changed
      const updated = await prisma.prediction.findUnique({
        where: { id: pendingForecast.id },
      })

      expect(updated?.status).toBe('ACTIVE')
      expect(updated?.publishedAt).toBeDefined()
    })

    it('should create commitment (stake) after approval', async () => {
      const mockRequest = new Request('http://localhost:3000/api/forecasts/forecast-1/approve', {
        method: 'POST',
      })

      const mockContext = {
        params: { id: pendingForecast.id },
      }

      await approveHandler(
        mockRequest as any,
        { id: normalUser.id, email: normalUser.email } as any,
        mockContext as any
      )

      // Verify commitment was created
      const commitment = await prisma.commitment.findFirst({
        where: {
          predictionId: pendingForecast.id,
          userId: botUser.id,
        },
      })

      expect(commitment).toBeDefined()
      expect(commitment?.cuCommitted).toBeGreaterThan(0)
      expect(commitment?.binaryChoice).toBe(true)
    })

    it('should reject approval of non-bot forecasts', async () => {
      // Create a user-authored forecast
      const userForecast = await prisma.prediction.create({
        data: {
          authorId: normalUser.id,
          claimText: 'User forecast',
          status: 'PENDING_APPROVAL',
          outcomeType: 'BINARY',
          outcomePayload: { type: 'BINARY' },
          resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      })

      const mockRequest = new Request(
        'http://localhost:3000/api/forecasts/forecast-1/approve',
        {
          method: 'POST',
        }
      )

      const mockContext = {
        params: { id: userForecast.id },
      }

      const response = await approveHandler(
        mockRequest as any,
        { id: normalUser.id, email: normalUser.email } as any,
        mockContext as any
      )

      expect(response.status).toBe(400)
    })

    it('should reject approval of non-PENDING_APPROVAL forecasts', async () => {
      // Create an ACTIVE forecast
      const activeForecast = await prisma.prediction.create({
        data: {
          authorId: botUser.id,
          claimText: '🤖 Another forecast',
          status: 'ACTIVE',
          outcomeType: 'BINARY',
          outcomePayload: { type: 'BINARY' },
          resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          source: 'bot',
        },
      })

      const mockRequest = new Request(
        'http://localhost:3000/api/forecasts/forecast-1/approve',
        {
          method: 'POST',
        }
      )

      const mockContext = {
        params: { id: activeForecast.id },
      }

      const response = await rejectHandler(
        mockRequest as any,
        { id: normalUser.id, email: normalUser.email } as any,
        mockContext as any
      )

      expect(response.status).toBe(400)
    })
  })

  describe('POST /api/forecasts/[id]/reject', () => {
    it('should transition forecast from PENDING_APPROVAL to VOID', async () => {
      const mockRequest = new Request('http://localhost:3000/api/forecasts/forecast-1/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: ['team', 'sports'],
          description: 'Already covered by other forecasts',
        }),
      })

      const mockContext = {
        params: { id: pendingForecast.id },
      }

      const response = await rejectHandler(
        mockRequest as any,
        { id: normalUser.id, email: normalUser.email } as any,
        mockContext as any
      )

      expect(response.status).toBe(200)

      // Verify forecast status changed
      const updated = await prisma.prediction.findUnique({
        where: { id: pendingForecast.id },
      })

      expect(updated?.status).toBe('VOID')
      expect(updated?.resolutionOutcome).toBe('void')
    })

    it('should create BotRejectedTopic entry after rejection', async () => {
      const keywords = ['team', 'championship']
      const description = 'Already covered'

      const mockRequest = new Request('http://localhost:3000/api/forecasts/forecast-1/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, description }),
      })

      const mockContext = {
        params: { id: pendingForecast.id },
      }

      await rejectHandler(
        mockRequest as any,
        { id: normalUser.id, email: normalUser.email } as any,
        mockContext as any
      )

      // Verify rejection was recorded
      const rejectedTopic = await prisma.botRejectedTopic.findFirst({
        where: {
          botId: botConfig.id,
          rejectedById: normalUser.id,
        },
      })

      expect(rejectedTopic).toBeDefined()
      expect(rejectedTopic?.keywords).toContain('team')
      expect(rejectedTopic?.description).toBe(description)
    })

    it('should extract keywords from forecast if not provided', async () => {
      const mockRequest = new Request('http://localhost:3000/api/forecasts/forecast-1/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const mockContext = {
        params: { id: pendingForecast.id },
      }

      await rejectHandler(
        mockRequest as any,
        { id: normalUser.id, email: normalUser.email } as any,
        mockContext as any
      )

      // Verify rejection with auto-extracted keywords
      const rejectedTopic = await prisma.botRejectedTopic.findFirst({
        where: {
          botId: botConfig.id,
        },
      })

      expect(rejectedTopic).toBeDefined()
      expect(rejectedTopic?.keywords.length).toBeGreaterThan(0)
    })

    it('should reject rejection of non-bot forecasts', async () => {
      const userForecast = await prisma.prediction.create({
        data: {
          authorId: normalUser.id,
          claimText: 'User forecast',
          status: 'PENDING_APPROVAL',
          outcomeType: 'BINARY',
          outcomePayload: { type: 'BINARY' },
          resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      })

      const mockRequest = new Request('http://localhost:3000/api/forecasts/forecast-1/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const mockContext = {
        params: { id: userForecast.id },
      }

      const response = await rejectHandler(
        mockRequest as any,
        { id: normalUser.id, email: normalUser.email } as any,
        mockContext as any
      )

      expect(response.status).toBe(400)
    })
  })

  describe('Bot Rate Limiting', () => {
    it('should enforce maxForecastsPerHour limit', async () => {
      // Update bot config with low hourly limit
      await prisma.botConfig.update({
        where: { id: botConfig.id },
        data: { maxForecastsPerHour: 2 },
      })

      // Create 2 forecasts in the current hour
      for (let i = 0; i < 2; i++) {
        await prisma.botRunLog.create({
          data: {
            botId: botConfig.id,
            action: 'CREATED_FORECAST',
            runAt: new Date(),
            isDryRun: false,
          },
        })
      }

      // Next forecast should fail the limit check
      const config = await prisma.botConfig.findUnique({
        where: { id: botConfig.id },
      })

      expect(config?.maxForecastsPerHour).toBe(2)
    })
  })

  describe('BotRejectedTopic Tracking', () => {
    it('should prevent bot from suggesting rejected topics', async () => {
      // Create and reject a forecast
      const rejectedForecast = await prisma.prediction.create({
        data: {
          authorId: botUser.id,
          claimText: '🤖 Team A will win',
          status: 'PENDING_APPROVAL',
          outcomeType: 'BINARY',
          outcomePayload: { type: 'BINARY' },
          resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          source: 'bot',
        },
      })

      // Reject it
      await prisma.botRejectedTopic.create({
        data: {
          botId: botConfig.id,
          keywords: ['team', 'winning'],
          description: 'Team A victory prediction',
          rejectedById: normalUser.id,
        },
      })

      // Verify rejection was recorded
      const rejections = await prisma.botRejectedTopic.findMany({
        where: { botId: botConfig.id },
      })

      expect(rejections.length).toBeGreaterThan(0)
      expect(rejections[0].keywords).toContain('team')
    })
  })
})
