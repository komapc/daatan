import { z } from 'zod'

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
})

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
})
