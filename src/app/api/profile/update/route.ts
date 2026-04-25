import { NextResponse } from 'next/server'
import { updateProfileSchema } from '@/lib/validations/profile'
import { apiError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { updateProfile } from '@/lib/services/user'

export const PATCH = withAuth(async (request, user) => {
  const body = await request.json()
  const validatedData = updateProfileSchema.parse(body)
  const result = await updateProfile(user.id, validatedData)
  if (!result.ok) return apiError(result.error, result.status)
  return NextResponse.json(result.data)
})
