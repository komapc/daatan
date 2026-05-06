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
})
