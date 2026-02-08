import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateProfileSchema } from '@/lib/validations/profile'
import { apiError, handleRouteError } from '@/lib/api-error'

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    const body = await request.json()
    const validatedData = updateProfileSchema.parse(body)

    // Check if username is already taken
    if (validatedData.username) {
      const existingUser = await prisma.user.findUnique({
        where: { username: validatedData.username }
      })

      if (existingUser && existingUser.id !== session.user.id) {
        return apiError('Username already taken', 400)
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
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
  } catch (error) {
    return handleRouteError(error, 'Failed to update profile')
  }
}
