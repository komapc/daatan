import { z } from 'zod'

// Source article schema
export const sourceArticleSchema = z.object({
  url: z.string().url('Invalid URL format'),
  title: z.string().optional(),
})

// Form schema (for client-side validation with react-hook-form)
const baseFormSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(500, 'Title too long'),
  text: z.string().max(5000, 'Description too long').optional(),
  sourceArticles: z.array(z.object({
    url: z.string().url('Invalid URL').or(z.literal('')),
    title: z.string().optional(),
  })).max(10).optional(),
  dueDate: z.string().min(1, 'Due date is required'),
  type: z.enum(['BINARY', 'MULTIPLE_CHOICE']),
  options: z.array(
    z.object({
      text: z.string().min(1, 'Option text is required').max(500),
    })
  ).min(2, 'At least 2 options required').max(10, 'Maximum 10 options'),
  status: z.enum(['DRAFT', 'ACTIVE']),
})

export const forecastFormSchema = baseFormSchema.refine(
  (data) => new Date(data.dueDate) > new Date(),
  { message: 'Due date must be in the future', path: ['dueDate'] }
).refine(
  (data) => data.type !== 'BINARY' || data.options.length === 2,
  { message: 'Binary forecasts must have exactly 2 options', path: ['options'] }
)

// Create forecast schema (for API - expects ISO datetime)
export const createForecastSchema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(500),
  text: z.string().max(5000).optional(),
  sourceArticles: z.array(sourceArticleSchema).max(10).optional(),
  dueDate: z.string().datetime(),
  type: z.enum(['BINARY', 'MULTIPLE_CHOICE']),
  options: z.array(
    z.object({
      text: z.string().min(1).max(500),
    })
  ).min(2, 'At least 2 options required').max(10, 'Maximum 10 options allowed'),
  status: z.enum(['DRAFT', 'ACTIVE']).optional().default('DRAFT'),
})

// Update forecast schema
export const updateForecastSchema = z.object({
  title: z.string().min(10).max(500).optional(),
  text: z.string().max(5000).optional().nullable(),
  sourceArticles: z.array(sourceArticleSchema).max(10).optional().nullable(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PENDING_RESOLUTION', 'CANCELLED']).optional(),
})

// Resolve forecast schema (admin only)
export const resolveForecastSchema = z.object({
  correctOptionId: z.string().cuid(),
  resolutionNote: z.string().max(2000).optional(),
})

// Vote schema
export const createVoteSchema = z.object({
  optionId: z.string().cuid(),
  confidence: z.number().int().min(1).max(100).default(50),
})

// Query params for listing forecasts
export const listForecastsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PENDING_RESOLUTION', 'RESOLVED', 'CANCELLED']).optional(),
  type: z.enum(['BINARY', 'MULTIPLE_CHOICE']).optional(),
  creatorId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ForecastFormData = z.infer<typeof forecastFormSchema>
export type CreateForecastInput = z.infer<typeof createForecastSchema>
export type UpdateForecastInput = z.infer<typeof updateForecastSchema>
export type ResolveForecastInput = z.infer<typeof resolveForecastSchema>
export type CreateVoteInput = z.infer<typeof createVoteSchema>
export type ListForecastsQuery = z.infer<typeof listForecastsQuerySchema>

