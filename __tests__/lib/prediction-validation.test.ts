import { describe, it, expect } from 'vitest'
import { listPredictionsQuerySchema } from '@/lib/validations/prediction'

describe('listPredictionsQuerySchema', () => {
  it('parses valid query with tags', () => {
    const result = listPredictionsQuerySchema.parse({
      status: 'ACTIVE',
      tags: 'AI,Crypto,Politics',
      page: 1,
      limit: 20,
    })

    expect(result.status).toBe('ACTIVE')
    expect(result.tags).toBe('AI,Crypto,Politics')
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  it('allows tags to be omitted', () => {
    const result = listPredictionsQuerySchema.parse({
      page: 1,
      limit: 20,
    })

    expect(result.tags).toBeUndefined()
  })

  it('rejects tags longer than 500 characters', () => {
    const longTags = 'a'.repeat(501)

    expect(() =>
      listPredictionsQuerySchema.parse({
        tags: longTags,
        page: 1,
        limit: 20,
      })
    ).toThrow()
  })

  it('accepts empty string for tags', () => {
    const result = listPredictionsQuerySchema.parse({
      tags: '',
      page: 1,
      limit: 20,
    })

    expect(result.tags).toBe('')
  })

  it('coerces page and limit from string', () => {
    const result = listPredictionsQuerySchema.parse({
      tags: 'AI',
      page: '2',
      limit: '10',
    })

    expect(result.page).toBe(2)
    expect(result.limit).toBe(10)
    expect(result.tags).toBe('AI')
  })

})
