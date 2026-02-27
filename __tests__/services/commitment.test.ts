import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Prisma mock ────────────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    commitment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    commitmentWithdrawal: { create: vi.fn() },
    cuTransaction: { create: vi.fn() },
    prediction: { update: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))

// ─── Side-effect mocks ───────────────────────────────────────────────────────
vi.mock('@/lib/services/telegram', () => ({ notifyNewCommitment: vi.fn() }))
vi.mock('@/lib/services/notification', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal commitment object for mocking. */
function makeCommitment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    userId: 'user-1',
    predictionId: 'pred-1',
    binaryChoice: true,
    optionId: null,
    cuCommitted: 100,
    rsSnapshot: 1.0,
    probability: null,
    createdAt: new Date(),
    cuReturned: null,
    rsChange: null,
    brierScore: null,
    prediction: {
      id: 'pred-1',
      status: 'ACTIVE',
      lockedAt: new Date(),
      claimText: 'Will X happen?',
      slug: 'will-x-happen',
      options: [],
    },
    ...overrides,
  }
}

// ─── calculatePenalty ─────────────────────────────────────────────────────────

describe('calculatePenalty (pure)', () => {
  it('applies the 10% minimum burn rate', async () => {
    const { calculatePenalty } = await import('@/lib/services/commitment')
    // yourSideCU / totalPoolCU = 5%, below 10% floor
    const result = calculatePenalty(100, 5, 100)
    expect(result.burnRate).toBe(10)
    expect(result.cuBurned).toBe(10)
    expect(result.cuRefunded).toBe(90)
  })

  it('uses yourSideShare when it exceeds 10%', async () => {
    const { calculatePenalty } = await import('@/lib/services/commitment')
    // yourSideCU / totalPoolCU = 60%
    const result = calculatePenalty(100, 60, 100)
    expect(result.burnRate).toBe(60)
    expect(result.cuBurned).toBe(60)
    expect(result.cuRefunded).toBe(40)
  })

  it('returns 0 burn when pool is empty (solo exit before anyone else joined)', async () => {
    const { calculatePenalty } = await import('@/lib/services/commitment')
    const result = calculatePenalty(100, 0, 0)
    expect(result.cuBurned).toBe(0)
    expect(result.cuRefunded).toBe(100)
    expect(result.burnRate).toBe(0)
  })

  it('floors cuBurned (no rounding up)', async () => {
    const { calculatePenalty } = await import('@/lib/services/commitment')
    // 33% of 100 = 33.33 → floor → 33
    const result = calculatePenalty(100, 33, 100)
    expect(result.cuBurned).toBe(33)
    expect(result.cuRefunded).toBe(67)
  })
})

// ─── removeCommitment ────────────────────────────────────────────────────────

describe('removeCommitment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when commitment not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { removeCommitment } = await import('@/lib/services/commitment')

    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(null)

    const result = await removeCommitment('user-1', 'pred-1')
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })

  it('returns 400 when prediction is not ACTIVE', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { removeCommitment } = await import('@/lib/services/commitment')

    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(
      makeCommitment({ prediction: { status: 'RESOLVED_CORRECT', lockedAt: new Date(), claimText: 'X', slug: null, options: [] } }) as any,
    )

    const result = await removeCommitment('user-1', 'pred-1')
    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
  })

  it('calculates penalty and executes transaction on success', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { removeCommitment } = await import('@/lib/services/commitment')

    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(makeCommitment() as any)
    // Pool: user committed 100 (true side), total pool 150 → yourSideShare = 100/150 ≈ 67%
    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      { userId: 'user-1', cuCommitted: 100, binaryChoice: true, optionId: null },
      { userId: 'user-2', cuCommitted: 50, binaryChoice: false, optionId: null },
    ] as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ cuAvailable: 0 } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma as any))
    vi.mocked(prisma.user.update).mockResolvedValue({ cuAvailable: 33 } as any)

    const result = await removeCommitment('user-1', 'pred-1')

    expect(result.ok).toBe(true)
    if (result.ok) {
      // yourSideShare = 100/150 ≈ 66.67% → burnRate 67%, cuBurned = floor(100 * 0.6666) = 66
      expect(result.data.burnRate).toBe(67)
      expect(result.data.cuBurned).toBe(66)
      expect(result.data.cuRefunded).toBe(34)
    }
    expect(prisma.$transaction).toHaveBeenCalledOnce()
  })

  it('applies minimum 10% burn when user is the minority', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { removeCommitment } = await import('@/lib/services/commitment')

    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(makeCommitment() as any)
    // Pool: user committed 10 on true side, 990 on false side → 1% → floor to 10%
    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      { userId: 'user-1', cuCommitted: 10, binaryChoice: true, optionId: null },
      { userId: 'user-2', cuCommitted: 990, binaryChoice: false, optionId: null },
    ] as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ cuAvailable: 0 } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma as any))
    vi.mocked(prisma.user.update).mockResolvedValue({ cuAvailable: 9 } as any)

    const result = await removeCommitment('user-1', 'pred-1')

    expect(result.ok).toBe(true)
    if (result.ok) {
      // commitment.cuCommitted = 100; burnRate = 10%; cuBurned = floor(100 * 0.10) = 10
      expect(result.data.burnRate).toBe(10)
      expect(result.data.cuBurned).toBe(10)
      expect(result.data.cuRefunded).toBe(90)
    }
  })
})

// ─── updateCommitment ────────────────────────────────────────────────────────

describe('updateCommitment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when commitment not found', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { updateCommitment } = await import('@/lib/services/commitment')

    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = await updateCommitment('user-1', 'pred-1', { cuCommitted: 50 })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
  })

  it('returns 400 when prediction is not ACTIVE', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { updateCommitment } = await import('@/lib/services/commitment')

    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(
      makeCommitment({ prediction: { status: 'PENDING', lockedAt: null, claimText: 'X', slug: null, options: [] } }) as any,
    )
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', cuAvailable: 200, cuLocked: 100, rs: 1 } as any)

    const result = await updateCommitment('user-1', 'pred-1', { cuCommitted: 50 })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
  })

  it('no-penalty path: simple CU decrease before lock', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { updateCommitment } = await import('@/lib/services/commitment')

    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(
      makeCommitment({ prediction: { status: 'ACTIVE', lockedAt: null, claimText: 'X', slug: null, options: [] } }) as any,
    )
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', cuAvailable: 200, cuLocked: 100, rs: 1 } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma as any))
    const updatedCommitment = makeCommitment({ cuCommitted: 50 })
    vi.mocked(prisma.commitment.update).mockResolvedValue({ ...updatedCommitment, user: {}, option: null } as any)

    const result = await updateCommitment('user-1', 'pred-1', { cuCommitted: 50 })

    expect(result.ok).toBe(true)
    // No pool state lookup since no penalty needed
    expect(prisma.commitment.findMany).not.toHaveBeenCalled()
  })

  it('penalty path: CU increase after lock applies penalty', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { updateCommitment } = await import('@/lib/services/commitment')

    // commitment is locked (lockedAt set), user wants to increase from 100 → 150
    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(makeCommitment() as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', cuAvailable: 200, cuLocked: 100, rs: 1 } as any)
    // Pool: user's 100 out of 200 total → 50% burn rate
    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      { userId: 'user-1', cuCommitted: 100, binaryChoice: true, optionId: null },
      { userId: 'user-2', cuCommitted: 100, binaryChoice: true, optionId: null },
    ] as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma as any))
    const updatedCommitment = makeCommitment({ cuCommitted: 150 })
    vi.mocked(prisma.commitment.update).mockResolvedValue({ ...updatedCommitment, user: {}, option: null } as any)

    const result = await updateCommitment('user-1', 'pred-1', { cuCommitted: 150 })

    expect(result.ok).toBe(true)
    // Penalty path: findMany called to compute pool state
    expect(prisma.commitment.findMany).toHaveBeenCalled()
  })

  it('penalty path: side switch after lock applies penalty', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { updateCommitment } = await import('@/lib/services/commitment')

    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(makeCommitment() as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', cuAvailable: 200, cuLocked: 100, rs: 1 } as any)
    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      { userId: 'user-1', cuCommitted: 100, binaryChoice: true, optionId: null },
      { userId: 'user-2', cuCommitted: 100, binaryChoice: false, optionId: null },
    ] as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma as any))
    vi.mocked(prisma.commitment.update).mockResolvedValue({ ...makeCommitment({ binaryChoice: false }), user: {}, option: null } as any)

    // Switch from true → false (side change)
    const result = await updateCommitment('user-1', 'pred-1', { binaryChoice: false })

    expect(result.ok).toBe(true)
    expect(prisma.commitment.findMany).toHaveBeenCalled()
  })

  it('returns 400 when insufficient CU after penalty on side switch', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { updateCommitment } = await import('@/lib/services/commitment')

    // User wants to switch and increase from 100 → 500, but only has 50 CU available
    vi.mocked(prisma.commitment.findUnique).mockResolvedValue(makeCommitment() as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user-1', cuAvailable: 50, cuLocked: 100, rs: 1 } as any)
    // Pool: user is 100% of the pool → 100% burn → refunded 0 → can't afford 500
    vi.mocked(prisma.commitment.findMany).mockResolvedValue([
      { userId: 'user-1', cuCommitted: 100, binaryChoice: true, optionId: null },
    ] as any)

    const result = await updateCommitment('user-1', 'pred-1', { binaryChoice: false, cuCommitted: 500 })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
  })
})
