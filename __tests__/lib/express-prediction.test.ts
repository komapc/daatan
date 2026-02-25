// Note: humanizeISODates is tested thoroughly in src/lib/llm/__tests__/humanizeISODates.test.ts

import { describe, it, expect } from 'vitest'
import { expressPredictionSchema } from '@/lib/llm/expressPrediction'
import { SchemaType } from '@google/generative-ai'

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
