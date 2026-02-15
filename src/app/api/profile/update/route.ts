import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateProfileSchema } from '@/lib/validations/profile'
import { apiError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'

export const PATCH = withAuth(async (request, user) => {
  const body = await request.json()
  const validatedData = updateProfileSchema.parse(body)

  // Check if username is already taken
  if (validatedData.username) {
    const existingUser = await prisma.user.findUnique({
      where: { username: validatedData.username }
    })

    if (existingUser && existingUser.id !== user.id) {
      return apiError('Username already taken', 400)
    }
  }

  // Update user profile
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      username: validatedData.username || null,
      website: validatedData.website || null,
      twitterHandle: validatedData.twitterHandle || null,
      emailNotifications: validatedData.emailNotifications,
    },
    select: {
      id: true,
      username: true,
      website: true,
      twitterHandle: true,
      emailNotifications: true,
    }
  })

  return NextResponse.json(updatedUser)
})
