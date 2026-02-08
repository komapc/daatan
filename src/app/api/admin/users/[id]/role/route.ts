import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiError, handleRouteError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

const updateRoleSchema = z.object({
  role: z.enum(['USER', 'RESOLVER', 'ADMIN']),
})

// PATCH /api/admin/users/[id]/role — assign or revoke roles
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole('admin')
  if ('error' in auth) return auth.error

  // Prevent self-demotion
  if (params.id === auth.user.id) {
    return NextResponse.json({ error: 'Cannot modify your own roles' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { role } = updateRoleSchema.parse(body)

    // Update role and sync legacy boolean flags
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        role,
        isAdmin: role === 'ADMIN',
        isModerator: role === 'RESOLVER' || role === 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        isAdmin: true,
        isModerator: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleRouteError(error, 'Failed to update user role')
  }
}
