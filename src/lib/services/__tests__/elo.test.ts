import { describe, it, expect } from 'vitest'
import { calculateEloUpdates } from '../elo'

describe('calculateEloUpdates', () => {
  it('returns empty map for fewer than 2 commitments', () => {
    expect(calculateEloUpdates([])).toEqual(new Map())
    expect(calculateEloUpdates([{ userId: 'a', brierScore: 0.1, eloRating: 1500 }])).toEqual(new Map())
  })

  it('winner gains ELO, loser loses ELO in equal-rated matchup', () => {
    const deltas = calculateEloUpdates([
      { userId: 'a', brierScore: 0.05, eloRating: 1500 }, // better (lower brier = win)
      { userId: 'b', brierScore: 0.40, eloRating: 1500 },
    ])
    expect(deltas.get('a')).toBeGreaterThan(0)
    expect(deltas.get('b')).toBeLessThan(0)
  })

  it('loser with higher rating loses more than lower-rated loser', () => {
    // a is rated 1600, b is 1400. a loses — should lose more than b would.
    const deltasHighLoses = calculateEloUpdates([
      { userId: 'a', brierScore: 0.40, eloRating: 1600 },
      { userId: 'b', brierScore: 0.05, eloRating: 1400 },
    ])
    const deltasLowLoses = calculateEloUpdates([
      { userId: 'a', brierScore: 0.05, eloRating: 1600 },
      { userId: 'b', brierScore: 0.40, eloRating: 1400 },
    ])
    // When high-rated player loses, they lose more ELO than when low-rated loses
    expect(deltasHighLoses.get('a')!).toBeLessThan(deltasLowLoses.get('b')!)
  })

  it('tie produces near-zero delta for equal-rated players', () => {
    const deltas = calculateEloUpdates([
      { userId: 'a', brierScore: 0.25, eloRating: 1500 },
      { userId: 'b', brierScore: 0.25, eloRating: 1500 },
    ])
    expect(deltas.get('a')).toBe(0)
    expect(deltas.get('b')).toBe(0)
  })

  it('sum of all deltas is approximately 0 (ELO conservation) in 3-way matchup', () => {
    const deltas = calculateEloUpdates([
      { userId: 'a', brierScore: 0.05, eloRating: 1500 },
      { userId: 'b', brierScore: 0.20, eloRating: 1520 },
      { userId: 'c', brierScore: 0.45, eloRating: 1480 },
    ])
    const total = [...deltas.values()].reduce((s, v) => s + v, 0)
    expect(Math.abs(total)).toBeLessThanOrEqual(2) // rounding can introduce ±1 per pair
  })

  it('fan-out: first place beats all others', () => {
    const deltas = calculateEloUpdates([
      { userId: 'winner', brierScore: 0.01, eloRating: 1500 },
      { userId: 'second', brierScore: 0.10, eloRating: 1500 },
      { userId: 'third',  brierScore: 0.30, eloRating: 1500 },
      { userId: 'fourth', brierScore: 0.49, eloRating: 1500 },
    ])
    expect(deltas.get('winner')).toBeGreaterThan(0)
    // winner should gain more than runner-up
    expect(deltas.get('winner')!).toBeGreaterThan(deltas.get('second')!)
    // last place should lose
    expect(deltas.get('fourth')).toBeLessThan(0)
  })
})
