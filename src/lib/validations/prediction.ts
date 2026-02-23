import { z } from 'zod'

// ============================================
// NEWS ANCHOR SCHEMAS
// ============================================

export const createNewsAnchorSchema = z.object({
  url: z.string().url('Invalid URL'),
  title: z.string().min(1).max(500),
  source: z.string().max(200).optional(),
  publishedAt: z.string().datetime().optional(),
  snippet: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
})

// ============================================
// PREDICTION SCHEMAS
// ============================================

export const outcomePayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('BINARY'),
  }),
  z.object({
    type: z.literal('MULTIPLE_CHOICE'),
    options: z.array(z.string().min(1).max(500)).min(2).max(10),
  }),
  z.object({
    type: z.literal('NUMERIC_THRESHOLD'),
    metric: z.string().min(1).max(200),
    threshold: z.number(),
    direction: z.enum(['above', 'below', 'exactly']),
    source: z.string().max(500).optional(),
  }),
])

export const createPredictionSchema = z.object({
  // News anchor (optional)
  newsAnchorId: z.string().cuid().optional(),
  newsAnchorUrl: z.string().url().optional(), // Alternative: create anchor from URL
  newsAnchorTitle: z.string().max(500).optional(), // Title when creating from URL

  // Prediction content
  claimText: z.string().min(10, 'Claim must be at least 10 characters').max(500),
  detailsText: z.string().max(5000).optional(),

  // Outcome definition
  outcomeType: z.enum(['BINARY', 'MULTIPLE_CHOICE', 'NUMERIC_THRESHOLD']),
  outcomePayload: z.record(z.string(), z.unknown()).optional(),

  // Resolution
  resolutionRules: z.string().max(2000).optional(),
  resolveByDatetime: z.string().datetime(),

  // Tags (1-5 tags from STANDARD_TAGS)
  tags: z.array(z.string().min(1).max(50)).min(1).max(5).optional(),
})

export const updatePredictionSchema = z.object({
  claimText: z.string().min(10).max(500).optional(),
  detailsText: z.string().max(5000).optional().nullable(),
  outcomePayload: z.record(z.string(), z.unknown()).optional(),
  resolutionRules: z.string().max(2000).optional().nullable(),
  resolveByDatetime: z.string().datetime().optional(),
  tags: z.array(z.string().min(1).max(50)).min(1).max(5).optional(),
})

// ============================================
// COMMITMENT SCHEMAS
// ============================================

export const createCommitmentSchema = z.object({
  cuCommitted: z.number().int().min(1).max(1000),
  // For binary predictions
  binaryChoice: z.boolean().optional(),
  // For multiple choice / numeric
  optionId: z.string().cuid().optional(),
}).refine(
  (data) => data.binaryChoice !== undefined || data.optionId !== undefined,
  { message: 'Must specify either binaryChoice or optionId' }
)

export const updateCommitmentSchema = z.object({
  cuCommitted: z.number().int().min(1).max(1000).optional(),
  binaryChoice: z.boolean().optional(),
  optionId: z.string().cuid().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Must provide at least one field to update' }
).refine(
  (data) => {
    // If both outcome fields are provided, that's invalid
    if (data.binaryChoice !== undefined && data.optionId !== undefined) {
      return false
    }
    return true
  },
  { message: 'Cannot specify both binaryChoice and optionId' }
)

export const listCommitmentsQuerySchema = z.object({
  predictionId: z.string().cuid().optional(),
  status: z.enum(['ACTIVE', 'PENDING', 'RESOLVED_CORRECT', 'RESOLVED_WRONG', 'VOID', 'UNRESOLVABLE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ============================================
// RESOLUTION SCHEMAS
// ============================================

export const resolvePredictionSchema = z.object({
  outcome: z.enum(['correct', 'wrong', 'void', 'unresolvable']),
  evidenceLinks: z.array(z.string().url()).optional(),
  resolutionNote: z.string().max(2000).optional(),
  // For multiple choice: which option was correct
  correctOptionId: z.string().cuid().optional(),
})

// ============================================
// QUERY SCHEMAS
// ============================================

export const listPredictionsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PENDING', 'PENDING_APPROVAL', 'RESOLVED_CORRECT', 'RESOLVED_WRONG', 'VOID', 'UNRESOLVABLE']).optional(),
  authorId: z.string().cuid().optional(),
  tags: z.string().max(500).optional(), // Comma-separated tag names for filtering
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateNewsAnchorInput = z.infer<typeof createNewsAnchorSchema>
export type CreatePredictionInput = z.infer<typeof createPredictionSchema>
export type UpdatePredictionInput = z.infer<typeof updatePredictionSchema>
export type CreateCommitmentInput = z.infer<typeof createCommitmentSchema>
export type UpdateCommitmentInput = z.infer<typeof updateCommitmentSchema>
export type ListCommitmentsQuery = z.infer<typeof listCommitmentsQuerySchema>
export type ResolvePredictionInput = z.infer<typeof resolvePredictionSchema>
export type ListPredictionsQuery = z.infer<typeof listPredictionsQuerySchema>

