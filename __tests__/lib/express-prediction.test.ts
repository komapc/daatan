import { describe, it, expect } from 'vitest'
import { humanizeISODates, expressPredictionSchema } from '@/lib/llm/expressPrediction'
import { SchemaType } from '@google/generative-ai'

describe('humanizeISODates', () => {
  it('replaces ISO datetime with human-readable format', () => {
    const input = 'By 2026-12-31T23:59:59Z, Bitcoin will reach $100k'
    const result = humanizeISODates(input)
    expect(result).toBe('By December 31, 2026, Bitcoin will reach $100k')
  })

  it('replaces multiple ISO dates in a string', () => {
    const input = 'Between 2026-01-15T00:00:00Z and 2026-06-30T23:59:59Z'
    const result = humanizeISODates(input)
    expect(result).toBe('Between January 15, 2026 and June 30, 2026')
  })

  it('handles ISO dates with milliseconds', () => {
    const input = 'By 2026-03-15T12:30:45.123Z'
    const result = humanizeISODates(input)
    expect(result).toBe('By March 15, 2026')
  })

  it('leaves non-ISO text unchanged', () => {
    const input = 'Bitcoin will reach $100k this year'
    const result = humanizeISODates(input)
    expect(result).toBe('Bitcoin will reach $100k this year')
  })

  it('handles empty string', () => {
    expect(humanizeISODates('')).toBe('')
  })
})

describe('expressPredictionSchema', () => {
  // Cast to access object schema properties — the Schema union type is narrow
  const schema = expressPredictionSchema as {
    properties: Record<string, unknown>
    required: string[]
  }

  it('includes outcomeType field', () => {
    expect(schema.properties).toHaveProperty('outcomeType')
    expect(schema.properties.outcomeType).toEqual({
      type: SchemaType.STRING,
      description: expect.stringContaining('BINARY'),
    })
  })

  it('includes options field as array', () => {
    expect(schema.properties).toHaveProperty('options')
    expect(schema.properties.options).toEqual({
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: expect.stringContaining('MULTIPLE_CHOICE'),
    })
  })

  it('requires outcomeType and options in the schema', () => {
    expect(schema.required).toContain('outcomeType')
    expect(schema.required).toContain('options')
  })

  it('still requires all original fields', () => {
    const requiredFields = ['claimText', 'resolveByDatetime', 'detailsText', 'tags', 'resolutionRules']
    for (const field of requiredFields) {
      expect(schema.required).toContain(field)
    }
  })
})
