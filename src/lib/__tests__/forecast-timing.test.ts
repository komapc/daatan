import { describe, it, expect, beforeEach } from 'vitest'
import { getEstimate, recordDuration } from '@/lib/forecast-timing'

describe('forecast-timing', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns sensible defaults when nothing is stored', () => {
    expect(getEstimate('forecast-create')).toBe(5000)
    expect(getEstimate('forecast-publish')).toBe(1500)
  })

  it('blends a recorded duration toward the new sample via EWMA', () => {
    // prev 5000, sample 10000 → round(5000*0.6 + 10000*0.4) = 7000
    recordDuration('forecast-create', 10000)
    expect(getEstimate('forecast-create')).toBe(7000)
  })

  it('converges toward repeated samples over successive runs', () => {
    for (let i = 0; i < 20; i++) recordDuration('forecast-publish', 3000)
    expect(getEstimate('forecast-publish')).toBeGreaterThan(2900)
    expect(getEstimate('forecast-publish')).toBeLessThanOrEqual(3000)
  })

  it('ignores non-positive or non-finite samples', () => {
    recordDuration('forecast-create', 0)
    recordDuration('forecast-create', -5)
    recordDuration('forecast-create', Number.NaN)
    expect(getEstimate('forecast-create')).toBe(5000)
  })

  it('falls back to default when stored value is corrupt', () => {
    window.localStorage.setItem('daatan:timing:forecast-create', 'not-a-number')
    expect(getEstimate('forecast-create')).toBe(5000)
  })
})
