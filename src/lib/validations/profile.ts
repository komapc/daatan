import { z } from 'zod'

export const updateProfileSchema = z.object({
  username: z.string().min(1).max(30).regex(/^[a-zA-Z0-9_]+$/).optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  twitterHandle: z.string().max(15).regex(/^[a-zA-Z0-9_]*$/).optional().or(z.literal('')),
  emailNotifications: z.boolean(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
