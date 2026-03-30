import { z } from 'zod'

export const registerSchema = z.object({
  name:     z.string().min(1).max(100).trim(),
  email:    z.string().email().toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
})

export const resetPasswordSchema = z.object({
  email:    z.string().email(),
  token:    z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
})

export const setPasswordSchema = z.object({
  password:        z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
  currentPassword: z.string().optional(),
})

export type RegisterInput       = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput  = z.infer<typeof resetPasswordSchema>
export type SetPasswordInput    = z.infer<typeof setPasswordSchema>
