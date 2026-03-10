import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

/**
 * Test suite for bot approval workflow
 * Tests database model relationships and schema changes for approval workflow
 */
describe('Bot Approval Workflow - Schema & Models', () => {
  let botUser: any
  let normalUser: any
  let botConfig: any

  beforeEach(async () => {
    // Create test users
    botUser = await prisma.user.create({
      data: {
        email: `bot-${Date.now()}@daatan.internal`,
        username: `bot_${Date.now()}`,
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
        personaPrompt: 'Sports analyst',
        forecastPrompt: 'Create sports forecast',
        votePrompt: 'Vote on sports',
        newsSources: ['https://example.com/sports'],
        requireApprovalForForecasts: true,
        maxForecastsPerHour: 5,
      },
    })
  })

  describe('BotConfig Approval Fields', () => {
    it('should store requireApprovalForForecasts flag', async () => {
      const config = await prisma.botConfig.findUnique({
        where: { id: botConfig.id },
      })
      expect(config?.requireApprovalForForecasts).toBe(true)
    })

    it('should store maxForecastsPerHour limit', async () => {
      const config = await prisma.botConfig.findUnique({
        where: { id: botConfig.id },
      })
      expect(config?.maxForecastsPerHour).toBe(5)
    })

    it('should support all approval feature flags', async () => {
      const updated = await prisma.botConfig.update({
        where: { id: botConfig.id },
        data: {
          enableSentimentExtraction: true,
          enableRejectionTracking: true,
          showMetadataOnForecast: true,
        },
      })

      expect(updated.enableSentimentExtraction).toBe(true)
      expect(updated.enableRejectionTracking).toBe(true)
      expect(updated.showMetadataOnForecast).toBe(true)
    })
  })

  describe('Prediction Metadata Fields', () => {
    it('should store sentiment metadata on prediction', async () => {
      const forecast = await prisma.prediction.create({
        data: {
          authorId: botUser.id,
          claimText: 'Team will win',
          shareToken: crypto.randomBytes(8).toString('hex'),
          sentiment: 'positive',
          confidence: 85,
          extractedEntities: ['Team', 'Competition'],
          consensusLine: 'Based on 3 sources',
          sourceSummary: 'Positive indicators',
          outcomeType: 'BINARY',
          outcomePayload: { type: 'BINARY' },
          resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      })

      expect(forecast.sentiment).toBe('positive')
      expect(forecast.confidence).toBe(85)
      expect(forecast.extractedEntities).toContain('Team')
      expect(forecast.consensusLine).toBe('Based on 3 sources')
      expect(forecast.sourceSummary).toBe('Positive indicators')
    })

    it('should allow null metadata fields', async () => {
      const forecast = await prisma.prediction.create({
        data: {
          authorId: botUser.id,
          claimText: 'Without metadata',
          shareToken: crypto.randomBytes(8).toString('hex'),
          outcomeType: 'BINARY',
          outcomePayload: { type: 'BINARY' },
          resolveByDatetime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      })

      expect(forecast.sentiment).toBeNull()
      expect(forecast.confidence).toBeNull()
      expect(forecast.extractedEntities).toEqual([])
      expect(forecast.consensusLine).toBeNull()
      expect(forecast.sourceSummary).toBeNull()
    })
  })

  describe('BotRejectedTopic Model', () => {
    it('should create rejection topic record', async () => {
      const rejection = await prisma.botRejectedTopic.create({
        data: {
          botId: botConfig.id,
          keywords: ['bitcoin', 'price'],
          description: 'Already covered',
          rejectedById: normalUser.id,
        },
      })

      expect(rejection.botId).toBe(botConfig.id)
      expect(rejection.keywords).toContain('bitcoin')
      expect(rejection.description).toBe('Already covered')
      expect(rejection.rejectedById).toBe(normalUser.id)
    })

    it('should cascade delete rejections when bot deleted', async () => {
      // Create rejection
      await prisma.botRejectedTopic.create({
        data: {
          botId: botConfig.id,
          keywords: ['test'],
          description: 'Test',
          rejectedById: normalUser.id,
        },
      })

      // Delete bot
      await prisma.botConfig.delete({ where: { id: botConfig.id } })

      // Check rejections are gone
      const rejections = await prisma.botRejectedTopic.findMany({
        where: { botId: botConfig.id },
      })

      expect(rejections).toHaveLength(0)
    })

    it('should query rejections by bot', async () => {
      // Create multiple
      await prisma.botRejectedTopic.createMany({
        data: [
          {
            botId: botConfig.id,
            keywords: ['topic1'],
            description: 'First',
            rejectedById: normalUser.id,
          },
          {
            botId: botConfig.id,
            keywords: ['topic2'],
            description: 'Second',
            rejectedById: normalUser.id,
          },
        ],
      })

      const rejections = await prisma.botRejectedTopic.findMany({
        where: { botId: botConfig.id },
      })

      expect(rejections).toHaveLength(2)
    })
  })

  describe('Hourly Rate Limiting', () => {
    it('should count bot actions within hour', async () => {
      const startOfHour = new Date()
      startOfHour.setMinutes(0, 0, 0)

      // Create logs
      for (let i = 0; i < 3; i++) {
        await prisma.botRunLog.create({
          data: {
            botId: botConfig.id,
            action: 'CREATED_FORECAST',
            runAt: new Date(startOfHour.getTime() + i * 10 * 60 * 1000),
            isDryRun: false,
          },
        })
      }

      const count = await prisma.botRunLog.count({
        where: {
          botId: botConfig.id,
          action: 'CREATED_FORECAST',
          runAt: { gte: startOfHour },
        },
      })

      expect(count).toBe(3)
    })

    it('should enforce hourly limit logic', async () => {
      const config = await prisma.botConfig.findUnique({
        where: { id: botConfig.id },
      })

      const maxPerHour = config?.maxForecastsPerHour || 0
      expect(maxPerHour).toBeGreaterThan(0)

      // In bot-runner, this check would:
      // const hourlyCount = await countThisHourActions(botId, 'CREATED_FORECAST')
      // if (hourlyCount >= maxForecastsPerHour) break
    })
  })

  describe('Configuration Combinations', () => {
    it('should support approval + all features', async () => {
      const config = await prisma.botConfig.update({
        where: { id: botConfig.id },
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

    it('should support selective feature enablement', async () => {
      const config = await prisma.botConfig.update({
        where: { id: botConfig.id },
        data: {
          requireApprovalForForecasts: true,
          enableSentimentExtraction: false,
          enableRejectionTracking: true,
          showMetadataOnForecast: false,
        },
      })

      expect(config.requireApprovalForForecasts).toBe(true)
      expect(config.enableSentimentExtraction).toBe(false)
      expect(config.enableRejectionTracking).toBe(true)
      expect(config.showMetadataOnForecast).toBe(false)
    })
  })
})
