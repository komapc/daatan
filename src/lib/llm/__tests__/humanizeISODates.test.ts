import { describe, it, expect } from 'vitest'
import { humanizeISODates } from '../expressPrediction'

describe('humanizeISODates', () => {
  it('replaces a full ISO timestamp with a human-readable date', () => {
    const input = 'Bitcoin will reach $100k by 2026-12-31T23:59:59Z'
    const result = humanizeISODates(input)
    expect(result).toBe('Bitcoin will reach $100k by December 31, 2026')
  })

  it('replaces ISO timestamp with milliseconds', () => {
    const input = 'Event happens on 2027-06-15T12:00:00.000Z'
    const result = humanizeISODates(input)
    expect(result).toBe('Event happens on June 15, 2027')
  })

  it('replaces multiple ISO timestamps in the same string', () => {
    const input = 'Between 2026-01-01T00:00:00Z and 2026-06-30T23:59:59Z'
    const result = humanizeISODates(input)
    expect(result).toContain('January 1, 2026')
    expect(result).toContain('June 30, 2026')
    expect(result).not.toContain('T')
  })

  it('leaves strings without ISO dates unchanged', () => {
    const input = 'This prediction has no dates at all'
    expect(humanizeISODates(input)).toBe(input)
  })

  it('leaves partial date strings unchanged (no time component)', () => {
    const input = 'Deadline is 2026-12-31'
    expect(humanizeISODates(input)).toBe(input)
  })

  it('handles empty string', () => {
    expect(humanizeISODates('')).toBe('')
  })

  it('handles date at the start of string', () => {
    const input = '2026-03-15T10:30:00Z is the deadline'
    const result = humanizeISODates(input)
    expect(result).toBe('March 15, 2026 is the deadline')
  })

  it('handles date at the end of string', () => {
    const input = 'Claim resolves by 2026-09-01T00:00:00Z'
    const result = humanizeISODates(input)
    expect(result).toBe('Claim resolves by September 1, 2026')
  })
})
