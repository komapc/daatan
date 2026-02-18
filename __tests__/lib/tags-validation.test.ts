import { describe, it, expect } from 'vitest'
import { createPredictionSchema, updatePredictionSchema } from '@/lib/validations/prediction'

describe('Tags Validation', () => {
  const basePrediction = {
    claimText: 'Test prediction claim',
    resolveByDatetime: '2026-12-31T23:59:59Z',
    outcomeType: 'BINARY' as const,
  }

  describe('createPredictionSchema', () => {
    it('accepts valid tags array (1-5 tags)', () => {
      const validData = {
        ...basePrediction,
        tags: ['AI', 'Technology'],
      }

      const result = createPredictionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('accepts single tag', () => {
      const validData = {
        ...basePrediction,
        tags: ['AI'],
      }

      const result = createPredictionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('accepts maximum 5 tags', () => {
      const validData = {
        ...basePrediction,
        tags: ['AI', 'Technology', 'Politics', 'Economy', 'Science'],
      }

      const result = createPredictionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('rejects more than 5 tags', () => {
      const invalidData = {
        ...basePrediction,
        tags: ['AI', 'Technology', 'Politics', 'Economy', 'Science', 'Crypto'],
      }

      const result = createPredictionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects empty tags array', () => {
      const invalidData = {
        ...basePrediction,
        tags: [],
      }

      const result = createPredictionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('accepts prediction without tags (optional field)', () => {
      const validData = {
        ...basePrediction,
      }

      const result = createPredictionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('rejects tags with empty strings', () => {
      const invalidData = {
        ...basePrediction,
        tags: ['AI', ''],
      }

      const result = createPredictionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects tags with names exceeding 50 characters', () => {
      const invalidData = {
        ...basePrediction,
        tags: ['a'.repeat(51)],
      }

      const result = createPredictionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('accepts tags with exactly 50 characters', () => {
      const validData = {
        ...basePrediction,
        tags: ['a'.repeat(50)],
      }

      const result = createPredictionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('accepts tags with special characters and spaces', () => {
      const validData = {
        ...basePrediction,
        tags: ['US Politics', 'AI/ML', 'Climate Change'],
      }

      const result = createPredictionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })
  })

  describe('updatePredictionSchema', () => {
    it('accepts valid tags array for update', () => {
      const validData = {
        tags: ['AI', 'Technology'],
      }

      const result = updatePredictionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('accepts single tag for update', () => {
      const validData = {
        tags: ['AI'],
      }

      const result = updatePredictionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('accepts maximum 5 tags for update', () => {
      const validData = {
        tags: ['AI', 'Technology', 'Politics', 'Economy', 'Science'],
      }

      const result = updatePredictionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('rejects more than 5 tags for update', () => {
      const invalidData = {
        tags: ['AI', 'Technology', 'Politics', 'Economy', 'Science', 'Crypto'],
      }

      const result = updatePredictionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects empty tags array for update', () => {
      const invalidData = {
        tags: [],
      }

      const result = updatePredictionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('accepts update without tags field', () => {
      const validData = {
        claimText: 'Updated claim',
      }

      const result = updatePredictionSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('rejects tags with empty strings for update', () => {
      const invalidData = {
        tags: ['AI', ''],
      }

      const result = updatePredictionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('rejects tags with names exceeding 50 characters for update', () => {
      const invalidData = {
        tags: ['a'.repeat(51)],
      }

      const result = updatePredictionSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('Type inference', () => {
    it('infers correct type for create schema', () => {
      const validData = {
        ...basePrediction,
        tags: ['AI', 'Technology'],
      }

      const result = createPredictionSchema.safeParse(validData)
      if (result.success) {
        // Type checking: these should all be valid
        expect(result.data.tags).toBeDefined()
        expect(Array.isArray(result.data.tags)).toBe(true)
        expect(result.data.tags?.[0]).toBe('AI')
      }
    })

    it('infers correct type for update schema', () => {
      const validData = {
        tags: ['AI'],
      }

      const result = updatePredictionSchema.safeParse(validData)
      if (result.success) {
        expect(result.data.tags).toBeDefined()
        expect(result.data.tags?.[0]).toBe('AI')
      }
    })
  })
})
