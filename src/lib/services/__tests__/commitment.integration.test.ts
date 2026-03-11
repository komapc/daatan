import { describe, it, expect, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createCommitment } from '../commitment'

// Mock external services that have side effects we don't want in DB tests
vi.mock('@/lib/services/telegram', () => ({
  notifyNewCommitment: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/lib/services/notification', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined)
}))

describe('Commitment Service Integration', () => {
  it('should create a commitment and update user balance correctly', async () => {
    // 1. Setup data in real Postgres
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        cuAvailable: 1000,
        rs: 100,
      }
    })

    const prediction = await prisma.prediction.create({
      data: {
        claimText: 'Integration Test Prediction',
        authorId: user.id,
        status: 'ACTIVE',
        outcomeType: 'BINARY',
        resolveByDatetime: new Date('2030-01-01'),
        shareToken: 'test-token-' + Date.now(),
      }
    })

    // 2. Execute service call
    const result = await createCommitment(user.id, prediction.id, {
      cuCommitted: 100,
      binaryChoice: true,
    })

    // 3. Verify result
    expect(result.ok).toBe(true)
    
    // 4. Verify DB state - User
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updatedUser?.cuAvailable).toBe(900)
    expect(updatedUser?.cuLocked).toBe(100)

    // 5. Verify DB state - Commitment
    const commitment = await prisma.commitment.findFirst({
      where: { userId: user.id, predictionId: prediction.id }
    })
    expect(commitment).toBeDefined()
    expect(commitment?.cuCommitted).toBe(100)
    expect(commitment?.binaryChoice).toBe(true)

    // 6. Verify DB state - Transaction log
    const transaction = await prisma.cuTransaction.findFirst({
      where: { userId: user.id, type: 'COMMITMENT_LOCK' }
    })
    expect(transaction).toBeDefined()
    expect(transaction?.amount).toBe(-100)
    expect(transaction?.balanceAfter).toBe(900)
  })

  it('should fail if user has insufficient balance', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'poor@example.com',
        cuAvailable: 10,
      }
    })

    const prediction = await prisma.prediction.create({
      data: {
        claimText: 'Expensive Prediction',
        authorId: user.id,
        status: 'ACTIVE',
        resolveByDatetime: new Date('2030-01-01'),
        shareToken: 'test-token-poor-' + Date.now(),
      }
    })

    const result = await createCommitment(user.id, prediction.id, {
      cuCommitted: 100,
      binaryChoice: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/insufficient/i)
    }

    // Verify balance was NOT changed
    const unchangedUser = await prisma.user.findUnique({ where: { id: user.id } })
    expect(unchangedUser?.cuAvailable).toBe(10)
  })
})
