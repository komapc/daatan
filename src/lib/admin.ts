import { getServerSession } from 'next-auth/next'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api-error'

export type RoleCheck = 'admin' | 'moderator' | 'adminOrModerator'

/**
 * Verify the current user has the required role.
 * Returns the user record on success, or a NextResponse error on failure.
 */
export async function requireRole(role: RoleCheck) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return { error: apiError('Unauthorized', 401) }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isAdmin: true, isModerator: true },
  })

  if (!user) {
    return { error: apiError('User not found', 401) }
  }

  const authorized =
    role === 'admin'
      ? user.isAdmin
      : role === 'moderator'
        ? user.isModerator
        : user.isAdmin || user.isModerator

  if (!authorized) {
    return { error: apiError('Forbidden', 403) }
  }

  return { user }
}
