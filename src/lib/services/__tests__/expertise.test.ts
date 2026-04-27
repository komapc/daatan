import { describe, it, expect, vi } from 'vitest'
import { glicko2Update, applyGlicko2Update } from '@/lib/services/expertise'

// ---------------------------------------------------------------------------
// glicko2Update — pure function, no mocks needed
// ---------------------------------------------------------------------------

describe('glicko2Update', () => {
  const DEFAULTS = { mu: 1500, phi: 350, volatility: 0.06 }

  it('returns numbers for all output fields', () => {
    const result = glicko2Update(DEFAULTS.mu, DEFAULTS.phi, DEFAULTS.volatility, 0.5)
    expect(typeof result.mu).toBe('number')
    expect(typeof result.phi).toBe('number')
    expect(typeof result.volatility).toBe('number')
    expect(isNaN(result.mu)).toBe(false)
    expect(isNaN(result.phi)).toBe(false)
    expect(isNaN(result.volatility)).toBe(false)
  })

  it('uncertainty (phi/sigma) shrinks after the first game', () => {
    const result = glicko2Update(DEFAULTS.mu, DEFAULTS.phi, DEFAULTS.volatility, 0.5)
    expect(result.phi).toBeLessThan(DEFAULTS.phi)
  })

  it('rating rises after a perfect prediction (score = 1)', () => {
    const result = glicko2Update(DEFAULTS.mu, DEFAULTS.phi, DEFAULTS.volatility, 1)
    expect(result.mu).toBeGreaterThan(DEFAULTS.mu)
  })

  it('rating falls after a worst prediction (score = 0)', () => {
    const result = glicko2Update(DEFAULTS.mu, DEFAULTS.phi, DEFAULTS.volatility, 0)
    expect(result.mu).toBeLessThan(DEFAULTS.mu)
  })

  it('score = 0.5 (random baseline) produces near-zero delta from 1500 start', () => {
    // Starting at μ=1500 against a reference at μ=1500: a score of 0.5 is
    // exactly what's expected, so μ should barely change.
    const result = glicko2Update(1500, 350, 0.06, 0.5)
    expect(Math.abs(result.mu - 1500)).toBeLessThan(5)
  })

  it('sigma converges toward a lower floor after many consistent wins', () => {
    let state = { ...DEFAULTS }
    for (let i = 0; i < 20; i++) {
      const r = glicko2Update(state.mu, state.phi, state.volatility, 1)
      state = { mu: r.mu, phi: r.phi, volatility: r.volatility }
    }
    // After 20 consistent wins uncertainty should be well below the initial 350
    expect(state.phi).toBeLessThan(200)
  })

  it('volatility stays in a reasonable range after many games', () => {
    let state = { ...DEFAULTS }
    for (let i = 0; i < 30; i++) {
      // alternating wins and losses
      const score = i % 2 === 0 ? 1 : 0
      const r = glicko2Update(state.mu, state.phi, state.volatility, score)
      state = { mu: r.mu, phi: r.phi, volatility: r.volatility }
    }
    expect(state.volatility).toBeGreaterThan(0)
    expect(state.volatility).toBeLessThan(1)
  })

  it('a high-rated expert gains less from a win than a fresh user', () => {
    const freshDelta = glicko2Update(1500, 350, 0.06, 1).mu - 1500
    const expertDelta = glicko2Update(1800, 80, 0.06, 1).mu - 1800
    // Expert has low uncertainty so each game moves them less
    expect(Math.abs(expertDelta)).toBeLessThan(Math.abs(freshDelta))
  })

  it('does not produce NaN or Infinity for edge-case inputs', () => {
    for (const score of [0, 1, 0.001, 0.999]) {
      const r = glicko2Update(1500, 350, 0.06, score)
      expect(isFinite(r.mu)).toBe(true)
      expect(isFinite(r.phi)).toBe(true)
      expect(isFinite(r.volatility)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// applyGlicko2Update — DB interaction (mocked tx)
// ---------------------------------------------------------------------------

describe('applyGlicko2Update', () => {
  const mockUpdate = vi.fn().mockResolvedValue({})
  const mockTx = { user: { update: mockUpdate } } as any

  const baseUser = {
    mu: 1500,
    sigma: 350,
    volatility: 0.06,
    totalPredictions: 5,
    correctPredictions: 3,
  }

  it('calls tx.user.update with the correct userId', async () => {
    mockUpdate.mockClear()
    await applyGlicko2Update(mockTx, 'user-123', baseUser, 0.1, true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-123' } }),
    )
  })

  it('increments totalPredictions by 1', async () => {
    mockUpdate.mockClear()
    await applyGlicko2Update(mockTx, 'user-1', baseUser, 0.1, false)
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.totalPredictions).toEqual({ increment: 1 })
  })

  it('increments correctPredictions when isCorrect = true', async () => {
    mockUpdate.mockClear()
    await applyGlicko2Update(mockTx, 'user-1', baseUser, 0.1, true)
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.correctPredictions).toEqual({ increment: 1 })
  })

  it('does NOT increment correctPredictions when isCorrect = false', async () => {
    mockUpdate.mockClear()
    await applyGlicko2Update(mockTx, 'user-1', baseUser, 0.9, false)
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.correctPredictions).toBeUndefined()
  })

  it('passes updated mu/sigma/volatility computed from brierScore', async () => {
    mockUpdate.mockClear()
    // brierScore = 0 → score = 1 → rating should rise
    await applyGlicko2Update(mockTx, 'user-1', baseUser, 0, true)
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.mu).toBeGreaterThan(baseUser.mu)
    expect(data.sigma).toBeLessThan(baseUser.sigma)
    expect(typeof data.volatility).toBe('number')
  })

  it('passes lowered mu for a worst prediction (brierScore = 1)', async () => {
    mockUpdate.mockClear()
    await applyGlicko2Update(mockTx, 'user-1', baseUser, 1, false)
    const data = mockUpdate.mock.calls[0][0].data
    expect(data.mu).toBeLessThan(baseUser.mu)
  })
})
