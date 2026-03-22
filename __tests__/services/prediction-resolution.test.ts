import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Prisma mock ─────────────────────────────────────────────────────────────
const mockTx = {
  prediction: { update: vi.fn() },
  predictionOption: { update: vi.fn() },
  commitment: { update: vi.fn() },
  user: { update: vi.fn() },
  cuTransaction: { create: vi.fn() },
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    prediction: { findUnique: vi.fn() },
    $transaction: vi.fn((fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUser(overrides = {}) {
  return { id: 'user-1', cuAvailable: 200, cuLocked: 100, rs: 50, ...overrides }
}

function makeCommitment(overrides = {}) {
  return {
    id: 'c1',
    userId: 'user-1',
    predictionId: 'pred-1',
    cuCommitted: 100,
    binaryChoice: true,
    optionId: null,
    probability: null,
    user: makeUser(),
    ...overrides,
  }
}

function makePrediction(overrides = {}) {
  return {
    id: 'pred-1',
    status: 'ACTIVE',
    outcomeType: 'BINARY',
    claimText: 'Will X happen?',
    slug: 'will-x-happen',
    winnersPoolBonus: 0,
    options: [],
    commitments: [makeCommitment()],
    withdrawals: [],
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('resolvePrediction', () => {
  let prisma: any

  beforeEach(async () => {
    vi.clearAllMocks()
    prisma = (await import('@/lib/prisma')).prisma
    // Reset tx mock return values
    mockTx.prediction.update.mockResolvedValue({ id: 'pred-1', status: 'RESOLVED_CORRECT' })
    mockTx.commitment.update.mockResolvedValue({})
    mockTx.user.update.mockResolvedValue({ cuAvailable: 250 })
    mockTx.cuTransaction.create.mockResolvedValue({})
    mockTx.predictionOption.update.mockResolvedValue({})
  })

  it('throws 404 when prediction is not found', async () => {
    prisma.prediction.findUnique.mockResolvedValue(null)
    const { resolvePrediction } = await import('@/lib/services/prediction-resolution')

    await expect(
      resolvePrediction('missing-id', { outcome: 'correct', resolvedById: 'admin-1' })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 400 when prediction is not in a resolvable status', async () => {
    prisma.prediction.findUnique.mockResolvedValue(makePrediction({ status: 'DRAFT' }))
    const { resolvePrediction } = await import('@/lib/services/prediction-resolution')

    await expect(
      resolvePrediction('pred-1', { outcome: 'correct', resolvedById: 'admin-1' })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when correctOptionId is missing for MULTIPLE_CHOICE', async () => {
    prisma.prediction.findUnique.mockResolvedValue(
      makePrediction({
        outcomeType: 'MULTIPLE_CHOICE',
        options: [{ id: 'opt-1' }, { id: 'opt-2' }],
      })
    )
    const { resolvePrediction } = await import('@/lib/services/prediction-resolution')

    await expect(
      resolvePrediction('pred-1', { outcome: 'correct', resolvedById: 'admin-1' })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('correctOptionId is required') })
  })

  it('throws 400 when correctOptionId does not match any option', async () => {
    prisma.prediction.findUnique.mockResolvedValue(
      makePrediction({
        outcomeType: 'MULTIPLE_CHOICE',
        options: [{ id: 'opt-1' }],
      })
    )
    const { resolvePrediction } = await import('@/lib/services/prediction-resolution')

    await expect(
      resolvePrediction('pred-1', { outcome: 'correct', resolvedById: 'admin-1', correctOptionId: 'opt-WRONG' })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('does not match') })
  })

  it('resolves correctly — winner gets 1.5x CU and positive RS change', async () => {
    prisma.prediction.findUnique.mockResolvedValue(makePrediction())
    const { resolvePrediction } = await import('@/lib/services/prediction-resolution')

    await resolvePrediction('pred-1', { outcome: 'correct', resolvedById: 'admin-1' })

    expect(mockTx.commitment.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({
        cuReturned: 150, // 100 * 1.5
        rsChange: 10,    // 100 * 0.1
      }),
    })
  })

  it('resolves wrongly — loser gets 0 CU and negative RS change', async () => {
    prisma.prediction.findUnique.mockResolvedValue(
      makePrediction({ commitments: [makeCommitment({ binaryChoice: false })] })
    )
    const { resolvePrediction } = await import('@/lib/services/prediction-resolution')

    await resolvePrediction('pred-1', { outcome: 'correct', resolvedById: 'admin-1' })

    expect(mockTx.commitment.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({
        cuReturned: 0,
        rsChange: -5, // 100 * -0.05
      }),
    })
  })

  it('void outcome refunds all CU with no RS change', async () => {
    prisma.prediction.findUnique.mockResolvedValue(makePrediction())
    const { resolvePrediction } = await import('@/lib/services/prediction-resolution')

    await resolvePrediction('pred-1', { outcome: 'void', resolvedById: 'admin-1' })

    expect(mockTx.commitment.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({
        cuReturned: 100, // full refund
        rsChange: 0,
      }),
    })
  })

  it('calculates Brier score when probability is set', async () => {
    prisma.prediction.findUnique.mockResolvedValue(
      makePrediction({ commitments: [makeCommitment({ probability: 0.8 })] })
    )
    const { resolvePrediction } = await import('@/lib/services/prediction-resolution')

    await resolvePrediction('pred-1', { outcome: 'correct', resolvedById: 'admin-1' })

    expect(mockTx.commitment.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({
        brierScore: expect.closeTo(0.04, 5), // (0.8 - 1)² = 0.04
      }),
    })
  })

  it('does not set Brier score on void outcome', async () => {
    prisma.prediction.findUnique.mockResolvedValue(
      makePrediction({ commitments: [makeCommitment({ probability: 0.8 })] })
    )
    const { resolvePrediction } = await import('@/lib/services/prediction-resolution')

    await resolvePrediction('pred-1', { outcome: 'void', resolvedById: 'admin-1' })

    const call = mockTx.commitment.update.mock.calls[0][0]
    expect(call.data).not.toHaveProperty('brierScore')
  })

  it('updates prediction status to RESOLVED_CORRECT', async () => {
    prisma.prediction.findUnique.mockResolvedValue(makePrediction())
    const { resolvePrediction } = await import('@/lib/services/prediction-resolution')

    await resolvePrediction('pred-1', { outcome: 'correct', resolvedById: 'admin-1' })

    expect(mockTx.prediction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RESOLVED_CORRECT', resolvedById: 'admin-1' }),
      })
    )
  })

  it('updates prediction status to VOID', async () => {
    prisma.prediction.findUnique.mockResolvedValue(makePrediction())
    const { resolvePrediction } = await import('@/lib/services/prediction-resolution')

    await resolvePrediction('pred-1', { outcome: 'void', resolvedById: 'admin-1' })

    expect(mockTx.prediction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'VOID' }),
      })
    )
  })
})
