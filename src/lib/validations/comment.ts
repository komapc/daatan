import { z } from 'zod'

export const createCommentSchema = z.object({
  text: z.string().min(1, 'Comment cannot be empty').max(2000, 'Comment too long'),
  predictionId: z.string().optional(),
  forecastId: z.string().optional(),
  parentId: z.string().optional(),
}).refine(
  (data) => data.predictionId || data.forecastId,
  { message: 'Either predictionId or forecastId must be provided' }
)

export const updateCommentSchema = z.object({
  text: z.string().min(1, 'Comment cannot be empty').max(2000, 'Comment too long'),
})

export const addReactionSchema = z.object({
  type: z.enum(['LIKE', 'INSIGHTFUL', 'DISAGREE']),
})

export const listCommentsQuerySchema = z.object({
  predictionId: z.string().optional(),
  forecastId: z.string().optional(),
  parentId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  page: z.coerce.number().int().positive().default(1),
})
