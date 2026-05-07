import { describe, it, expect } from 'vitest'
import { buildForecastDescription } from '../forecast-seo'

describe('buildForecastDescription', () => {
  it('uses detailsText when long enough', () => {
    const claim = 'Will it rain tomorrow?'
    const details = 'A detailed analysis of weather patterns suggests rain is likely in the morning.'
    expect(buildForecastDescription(claim, details)).toBe(details)
  })

  it('falls back to claimText when detailsText is empty', () => {
    const claim = 'Will the candidate win the election by December 31, 2026?'
    expect(buildForecastDescription(claim, null)).toBe(claim)
    expect(buildForecastDescription(claim, '')).toBe(claim)
    expect(buildForecastDescription(claim, '   ')).toBe(claim)
  })

  it('falls back to claimText when detailsText is too short to be useful', () => {
    const claim = 'Will the candidate win the election by December 31, 2026?'
    expect(buildForecastDescription(claim, 'TBD')).toBe(claim)
  })

  it('truncates long detailsText to fit meta description limits', () => {
    const claim = 'Short claim'
    const long = 'a'.repeat(300)
    const result = buildForecastDescription(claim, long)
    expect(result.length).toBeLessThanOrEqual(158)
    expect(result.endsWith('…')).toBe(true)
  })

  it('truncates long claimText when no details are available', () => {
    const long = 'a'.repeat(300)
    const result = buildForecastDescription(long, null)
    expect(result.length).toBeLessThanOrEqual(158)
    expect(result.endsWith('…')).toBe(true)
  })

  it('returns unique descriptions for different forecasts (no shared template)', () => {
    const a = buildForecastDescription('Forecast A about Iran', null)
    const b = buildForecastDescription('Forecast B about Russia', null)
    expect(a).not.toBe(b)
  })

  it('enriches fallback with ctx when detailsText is absent', () => {
    const claim = 'Will inflation drop below 3% by year end?'
    const result = buildForecastDescription(claim, null, {
      commitmentCount: 12,
      resolveByDatetime: '2026-12-31T00:00:00Z',
    })
    expect(result).toContain('12 forecasters have committed')
    expect(result).toContain('resolves')
    expect(result.length).toBeLessThanOrEqual(158)
  })

  it('uses singular "forecaster" when commitmentCount is 1', () => {
    const result = buildForecastDescription('Will X happen?', null, { commitmentCount: 1 })
    expect(result).toContain('1 forecaster have committed')
  })

  it('ignores ctx when detailsText is long enough', () => {
    const details = 'A detailed analysis of weather patterns suggests rain is likely in the morning.'
    const result = buildForecastDescription('Will it rain?', details, {
      commitmentCount: 5,
      resolveByDatetime: '2026-12-31T00:00:00Z',
    })
    expect(result).toBe(details)
    expect(result).not.toContain('forecaster')
  })

  it('falls back to claimText when ctx is empty', () => {
    const claim = 'Will the market recover?'
    const result = buildForecastDescription(claim, null, {})
    expect(result).toBe(claim)
  })
})
