import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-middleware'
import { updateLanguage } from '@/lib/services/user'

const languageSchema = z.object({
  language: z.enum(['en', 'he', 'ru', 'eo']),
})

// PATCH /api/profile/language - Update user's preferred language
export const PATCH = withAuth(async (request, user) => {
  const body = await request.json()
  const { language } = languageSchema.parse(body)
  await updateLanguage(user.id, language)
  return NextResponse.json({ language })
})
