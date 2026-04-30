import { describe, it, expect } from 'vitest'
import { SCORING_SYSTEMS } from '@/lib/services/scoring-systems'
import type { ScoringContext } from '@/lib/services/scoring-systems'

const user = { id: 'u1', rs: 1200, mu: 1550, sigma: 120, eloRating: 1480 }

function ctx(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    cuByUser: new Map(),
    resolvedByUser: new Map(),
    brierByUser: new Map(),
    peerScoreByUser: new Map(),
    aiScoreByUser: new Map(),
    rsChangeByUser: new Map(),
    weightedPeerScoreByUser: new Map(),
    eloByUser: new Map(),
    glickoByUser: new Map(),
    ...overrides,
  }
}

function sys(key: string) {
  return SCORING_SYSTEMS.find(s => s.key === key)!
}

describe('rs', () => {
  it('returns user.rs', () => {
    expect(sys('rs').compute('u1', user, ctx())).toBe(1200)
  })
})

describe('accuracy', () => {
  it('returns correct/total ratio', () => {
    const c = ctx({ resolvedByUser: new Map([['u1', { total: 10, correct: 8 }]]) })
    expect(sys('accuracy').compute('u1', user, c)).toBeCloseTo(0.8)
  })

  it('returns null when total is 0', () => {
    const c = ctx({ resolvedByUser: new Map([['u1', { total: 0, correct: 0 }]]) })
    expect(sys('accuracy').compute('u1', user, c)).toBeNull()
  })

  it('returns null when user not in map', () => {
    expect(sys('accuracy').compute('u1', user, ctx())).toBeNull()
  })
})

describe('totalCorrect', () => {
  it('returns correct count', () => {
    const c = ctx({ resolvedByUser: new Map([['u1', { total: 10, correct: 7 }]]) })
    expect(sys('totalCorrect').compute('u1', user, c)).toBe(7)
  })

  it('returns 0 when user not in map', () => {
    expect(sys('totalCorrect').compute('u1', user, ctx())).toBe(0)
  })
})

describe('cuCommitted', () => {
  it('returns total CU', () => {
    const c = ctx({ cuByUser: new Map([['u1', 500]]) })
    expect(sys('cuCommitted').compute('u1', user, c)).toBe(500)
  })

  it('returns 0 when user not in map', () => {
    expect(sys('cuCommitted').compute('u1', user, ctx())).toBe(0)
  })
})

describe('brierScore', () => {
  it('returns avg brier score', () => {
    const c = ctx({ brierByUser: new Map([['u1', { avg: 0.12, count: 5 }]]) })
    expect(sys('brierScore').compute('u1', user, c)).toBeCloseTo(0.12)
  })

  it('returns null when avg is null', () => {
    const c = ctx({ brierByUser: new Map([['u1', { avg: null, count: 5 }]]) })
    expect(sys('brierScore').compute('u1', user, c)).toBeNull()
  })

  it('returns null when user not in map', () => {
    expect(sys('brierScore').compute('u1', user, ctx())).toBeNull()
  })

  it('is marked lowerIsBetter', () => {
    expect(sys('brierScore').lowerIsBetter).toBe(true)
  })
})

describe('peerScore', () => {
  it('returns sum', () => {
    const c = ctx({ peerScoreByUser: new Map([['u1', { sum: 3.5, count: 10 }]]) })
    expect(sys('peerScore').compute('u1', user, c)).toBeCloseTo(3.5)
  })

  it('returns null when user not in map', () => {
    expect(sys('peerScore').compute('u1', user, ctx())).toBeNull()
  })
})

describe('aiScore', () => {
  it('returns value', () => {
    const c = ctx({ aiScoreByUser: new Map([['u1', 2.1]]) })
    expect(sys('aiScore').compute('u1', user, c)).toBeCloseTo(2.1)
  })

  it('returns null when user not in map', () => {
    expect(sys('aiScore').compute('u1', user, ctx())).toBeNull()
  })
})

describe('elo', () => {
  it('returns elo from context when present', () => {
    const c = ctx({ eloByUser: new Map([['u1', 1600]]) })
    expect(sys('elo').compute('u1', user, c)).toBe(1600)
  })

  it('falls back to user.eloRating when not in context', () => {
    expect(sys('elo').compute('u1', user, ctx())).toBe(1480)
  })
})

describe('glicko', () => {
  it('returns mu - 3*sigma from context', () => {
    const c = ctx({ glickoByUser: new Map([['u1', { mu: 1600, sigma: 100 }]]) })
    expect(sys('glicko').compute('u1', user, c)).toBe(1300)
  })

  it('falls back to user.mu/sigma when not in context', () => {
    expect(sys('glicko').compute('u1', user, ctx())).toBe(user.mu - 3 * user.sigma)
  })

  it('returns null for per-tag count < 3', () => {
    const c = ctx({ glickoByUser: new Map([['u1', { mu: 1600, sigma: 100, count: 2 }]]) })
    expect(sys('glicko').compute('u1', user, c)).toBeNull()
  })

  it('returns score for per-tag count >= 3', () => {
    const c = ctx({ glickoByUser: new Map([['u1', { mu: 1600, sigma: 100, count: 3 }]]) })
    expect(sys('glicko').compute('u1', user, c)).toBe(1300)
  })

  it('ignores minimum when count is absent (global)', () => {
    const c = ctx({ glickoByUser: new Map([['u1', { mu: 1600, sigma: 100 }]]) })
    expect(sys('glicko').compute('u1', user, c)).toBe(1300)
  })
})

describe('roi', () => {
  it('returns sum/count when count >= 3', () => {
    const c = ctx({ rsChangeByUser: new Map([['u1', { sum: 30, count: 5 }]]) })
    expect(sys('roi').compute('u1', user, c)).toBe(6)
  })

  it('returns null when count < 3', () => {
    const c = ctx({ rsChangeByUser: new Map([['u1', { sum: 10, count: 2 }]]) })
    expect(sys('roi').compute('u1', user, c)).toBeNull()
  })

  it('returns null when user not in map', () => {
    expect(sys('roi').compute('u1', user, ctx())).toBeNull()
  })
})

describe('truthScore', () => {
  it('returns sum/count when count >= 3', () => {
    const c = ctx({ peerScoreByUser: new Map([['u1', { sum: 1.5, count: 5 }]]) })
    expect(sys('truthScore').compute('u1', user, c)).toBe(0.3)
  })

  it('returns null when count < 3', () => {
    const c = ctx({ peerScoreByUser: new Map([['u1', { sum: 1.5, count: 2 }]]) })
    expect(sys('truthScore').compute('u1', user, c)).toBeNull()
  })

  it('returns null when sum is null', () => {
    const c = ctx({ peerScoreByUser: new Map([['u1', { sum: null, count: 5 }]]) })
    expect(sys('truthScore').compute('u1', user, c)).toBeNull()
  })

  it('returns null when user not in map', () => {
    expect(sys('truthScore').compute('u1', user, ctx())).toBeNull()
  })
})

describe('weightedPeerScore', () => {
  it('returns the value from context', () => {
    const c = ctx({ weightedPeerScoreByUser: new Map([['u1', 0.42]]) })
    expect(sys('weightedPeerScore').compute('u1', user, c)).toBeCloseTo(0.42)
  })

  it('returns null when user not in map', () => {
    expect(sys('weightedPeerScore').compute('u1', user, ctx())).toBeNull()
  })

  it('returns null when value is null (< 3 predictions)', () => {
    const c = ctx({ weightedPeerScoreByUser: new Map([['u1', null]]) })
    expect(sys('weightedPeerScore').compute('u1', user, c)).toBeNull()
  })
})

describe('SCORING_SYSTEMS registry', () => {
  it('covers all SortBy keys', () => {
    const keys = SCORING_SYSTEMS.map(s => s.key)
    expect(keys).toContain('rs')
    expect(keys).toContain('accuracy')
    expect(keys).toContain('brierScore')
    expect(keys).toContain('elo')
    expect(keys).toContain('glicko')
    expect(keys).toContain('roi')
    expect(keys).toContain('truthScore')
    expect(keys).toContain('weightedPeerScore')
    expect(keys).toHaveLength(12)
  })
})
