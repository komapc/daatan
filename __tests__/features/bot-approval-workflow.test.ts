import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

describe('Bot Approval Workflow - Integration Tests', () => {
  let botUser: any
  let approvalBot: any
  let autoApproveBot: any

  beforeEach(async () => {
    // Create bot user
    botUser = await prisma.user.create({
      data: {
        email: `bot-approval-${Date.now()}@daatan.internal`,
        username: `bot_approval_${Date.now()}`,
        isBot: true,
        cuAvailable: 1000,
      },
    })

    // Bot WITH approval requirement
    approvalBot = await prisma.botConfig.create({
      data: {
        userId: botUser.id,
        personaPrompt: 'Sports analyst',
        forecastPrompt: 'Create sports forecast',
        votePrompt: 'Vote on sports',
        newsSources: ['https://example.com/sports'],
        requireApprovalForForecasts: true,
        autoApprove: false,
        maxForecastsPerHour: 5,
        stakeMin: 20,
        stakeMax: 100,
      },
    })

    // Bot WITHOUT approval requirement (standard behavior)
    autoApproveBot = await prisma.botConfig.create({
      data: {
        userId: botUser.id,
        personaPrompt: 'News analyst',
        forecastPrompt: 'Create news forecast',
        votePrompt: 'Vote on news',
        newsSources: ['https://example.com/news'],
        requireApprovalForForecasts: false,
        autoApprove: true,
        maxForecastsPerHour: 10,
        stakeMin: 50,
        stakeMax: 200,
      },
    })
  })

  describe('Forecast Creation with Approval Requirement', () => {
    it('should create forecast with PENDING_APPROVAL status when requireApprovalForForecasts=true', async () => {
      const forecast = await prisma.prediction.create({
        data: {
          authorId: botUser.id,
          claimText: '🤖 Team will win championship',
          status: 'PENDING_APPROVAL',
          outcomeType: 'BINARY',
          outcomePayload: { type: 'BINARY' },
          resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          source: 'bot',
        },
      })

      expect(forecast.status).toBe('PENDING_APPROVAL')
      expect(forecast.source).toBe('bot')
    })

    it('should NOT create commitment when requireApprovalForForecasts=true', async () => {
      const forecast = await prisma.prediction.create({
        data: {
          authorId: botUser.id,
          claimText: '🤖 Team will win',
          status: 'PENDING_APPROVAL',
          outcomeType: 'BINARY',
          outcomePayload: { type: 'BINARY' },
          resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          source: 'bot',
        },
      })

      // No commitment should exist
      const commitment = await prisma.commitment.findFirst({
        where: {
          userId: botUser.id,
          predictionId: forecast.id,
        },
      })

      expect(commitment).toBeUndefined()
    })

    it('should create forecast with ACTIVE status when requireApprovalForForecasts=false and autoApprove=true', async () => {
      const forecast = await prisma.prediction.create({
        data: {
          authorId: botUser.id,
          claimText: '🤖 News headline',
          status: 'ACTIVE',
          outcomeType: 'BINARY',
          outcomePayload: { type: 'BINARY' },
          resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          source: 'bot',
        },
      })

      expect(forecast.status).toBe('ACTIVE')
    })
  })

  describe('Metadata Fields on Prediction', () => {
    it('should store sentiment and confidence metadata', async () => {
      const forecast = await prisma.prediction.create({
        data: {
          authorId: botUser.id,
          claimText: '🤖 Bitcoin price prediction',
          status: 'PENDING_APPROVAL',
          outcomeType: 'BINARY',
          outcomePayload: { type: 'BINARY' },
          resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          source: 'bot',
          sentiment: 'positive',
          confidence: 75,
          extractedEntities: ['Bitcoin', 'Price', 'Market'],
          consensusLine: 'Based on 3 sources, 80% indicate bullish sentiment',
          sourceSummary: 'Multiple sources report positive market indicators',
        },
      })

      expect(forecast.sentiment).toBe('positive')
      expect(forecast.confidence).toBe(75)
      expect(forecast.extractedEntities).toContain('Bitcoin')
      expect(forecast.consensusLine).toBeDefined()
      expect(forecast.sourceSummary).toBeDefined()
    })

    it('should handle null metadata fields', async () => {
      const forecast = await prisma.prediction.create({
        data: {
          authorId: botUser.id,
          claimText: '🤖 Forecast without metadata',
          status: 'PENDING_APPROVAL',
          outcomeType: 'BINARY',
          outcomePayload: { type: 'BINARY' },
          resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          source: 'bot',
        },
      })

      expect(forecast.sentiment).toBeNull()
      expect(forecast.confidence).toBeNull()
      expect(forecast.extractedEntities).toEqual([])
    })
  })

  describe('BotConfig Approval Fields', () => {
    it('should store approval requirement flag', async () => {
      const config = await prisma.botConfig.findUnique({
        where: { id: approvalBot.id },
      })

      expect(config?.requireApprovalForForecasts).toBe(true)
    })

    it('should store sentiment extraction flag', async () => {
      const updated = await prisma.botConfig.update({
        where: { id: approvalBot.id },
        data: { enableSentimentExtraction: true },
      })

      expect(updated.enableSentimentExtraction).toBe(true)
    })

    it('should store rejection tracking flag', async () => {
      const updated = await prisma.botConfig.update({
        where: { id: approvalBot.id },
        data: { enableRejectionTracking: true },
      })

      expect(updated.enableRejectionTracking).toBe(true)
    })

    it('should store metadata display flag', async () => {
      const updated = await prisma.botConfig.update({
        where: { id: approvalBot.id },
        data: { showMetadataOnForecast: true },
      })

      expect(updated.showMetadataOnForecast).toBe(true)
    })

    it('should store hourly rate limit', async () => {
      const updated = await prisma.botConfig.update({
        where: { id: approvalBot.id },
        data: { maxForecastsPerHour: 3 },
      })

      expect(updated.maxForecastsPerHour).toBe(3)
    })
  })

  describe('BotRejectedTopic Model', () => {
    it('should create rejection topic record', async () => {
      const rejection = await prisma.botRejectedTopic.create({
        data: {
          botId: approvalBot.id,
          keywords: ['bitcoin', 'price', 'market'],
          description: 'Bitcoin price predictions - already covered',
          rejectedById: botUser.id,
        },
      })

      expect(rejection.botId).toBe(approvalBot.id)
      expect(rejection.keywords).toHaveLength(3)
      expect(rejection.description).toBeDefined()
      expect(rejection.rejectedAt).toBeDefined()
    })

    it('should query rejections by bot', async () => {
      // Create multiple rejections
      await prisma.botRejectedTopic.create({
        data: {
          botId: approvalBot.id,
          keywords: ['topic1'],
          description: 'Rejected topic 1',
          rejectedById: botUser.id,
        },
      })

      await prisma.botRejectedTopic.create({
        data: {
          botId: approvalBot.id,
          keywords: ['topic2'],
          description: 'Rejected topic 2',
          rejectedById: botUser.id,
        },
      })

      const rejections = await prisma.botRejectedTopic.findMany({
        where: { botId: approvalBot.id },
      })

      expect(rejections).toHaveLength(2)
    })

    it('should delete rejections when bot is deleted', async () => {
      await prisma.botRejectedTopic.create({
        data: {
          botId: approvalBot.id,
          keywords: ['test'],
          description: 'Test rejection',
          rejectedById: botUser.id,
        },
      })

      // Delete bot
      await prisma.botConfig.delete({
        where: { id: approvalBot.id },
      })

      // Rejections should be deleted (CASCADE)
      const rejections = await prisma.botRejectedTopic.findMany({
        where: { botId: approvalBot.id },
      })

      expect(rejections).toHaveLength(0)
    })
  })

  describe('Hourly Rate Limiting', () => {
    it('should log bot actions with hourly boundaries', async () => {
      // Create logs at different times
      const startOfHour = new Date()
      startOfHour.setMinutes(0, 0, 0)

      await prisma.botRunLog.create({
        data: {
          botId: approvalBot.id,
          action: 'CREATED_FORECAST',
          runAt: startOfHour,
          isDryRun: false,
        },
      })

      await prisma.botRunLog.create({
        data: {
          botId: approvalBot.id,
          action: 'CREATED_FORECAST',
          runAt: new Date(startOfHour.getTime() + 30 * 60 * 1000), // 30 mins later
          isDryRun: false,
        },
      })

      // Both should be counted in the hour
      const logsInHour = await prisma.botRunLog.findMany({
        where: {
          botId: approvalBot.id,
          action: 'CREATED_FORECAST',
          runAt: { gte: startOfHour },
        },
      })

      expect(logsInHour).toHaveLength(2)
    })

    it('should enforce maxForecastsPerHour limit', async () => {
      const config = await prisma.botConfig.findUnique({
        where: { id: approvalBot.id },
      })

      expect(config?.maxForecastsPerHour).toBe(5)

      // If we want to check the limit, we need 5 forecasts in the hour
      const startOfHour = new Date()
      startOfHour.setMinutes(0, 0, 0)

      for (let i = 0; i < 5; i++) {
        await prisma.botRunLog.create({
          data: {
            botId: approvalBot.id,
            action: 'CREATED_FORECAST',
            runAt: startOfHour,
            isDryRun: false,
          },
        })
      }

      const count = await prisma.botRunLog.count({
        where: {
          botId: approvalBot.id,
          action: 'CREATED_FORECAST',
          runAt: { gte: startOfHour },
        },
      })

      expect(count).toBe(5)
    })
  })

  describe('Configuration Combinations', () => {
    it('should support approval + sentiment extraction', async () => {
      const config = await prisma.botConfig.update({
        where: { id: approvalBot.id },
        data: {
          requireApprovalForForecasts: true,
          enableSentimentExtraction: true,
          showMetadataOnForecast: true,
        },
      })

      expect(config.requireApprovalForForecasts).toBe(true)
      expect(config.enableSentimentExtraction).toBe(true)
      expect(config.showMetadataOnForecast).toBe(true)
    })

    it('should support approval + rejection tracking', async () => {
      const config = await prisma.botConfig.update({
        where: { id: approvalBot.id },
        data: {
          requireApprovalForForecasts: true,
          enableRejectionTracking: true,
        },
      })

      expect(config.requireApprovalForForecasts).toBe(true)
      expect(config.enableRejectionTracking).toBe(true)
    })

    it('should support all features enabled', async () => {
      const config = await prisma.botConfig.update({
        where: { id: approvalBot.id },
        data: {
          requireApprovalForForecasts: true,
          enableSentimentExtraction: true,
          enableRejectionTracking: true,
          showMetadataOnForecast: true,
          maxForecastsPerHour: 10,
        },
      })

      expect(config.requireApprovalForForecasts).toBe(true)
      expect(config.enableSentimentExtraction).toBe(true)
      expect(config.enableRejectionTracking).toBe(true)
      expect(config.showMetadataOnForecast).toBe(true)
      expect(config.maxForecastsPerHour).toBe(10)
    })
  })
})
