import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

const languageSchema = z.object({
  language: z.enum(['en', 'he']),
})

// PATCH /api/profile/language - Update user's preferred language
export const PATCH = withAuth(async (request, user) => {
  const body = await request.json()
  const { language } = languageSchema.parse(body)

  await prisma.user.update({
    where: { id: user.id },
    data: { preferredLanguage: language },
  })

  return NextResponse.json({ language })
})
