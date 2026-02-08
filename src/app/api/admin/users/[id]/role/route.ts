import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiError, handleRouteError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

const updateRoleSchema = z.object({
  isAdmin: z.boolean().optional(),
  isModerator: z.boolean().optional(),
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
    return apiError('Cannot modify your own roles', 400)
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  })

  if (!target) {
    return apiError('User not found', 404)
  }

  const body = await request.json()
  const data = updateRoleSchema.parse(body)

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(data.isAdmin !== undefined && { isAdmin: data.isAdmin }),
      ...(data.isModerator !== undefined && { isModerator: data.isModerator }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      isAdmin: true,
      isModerator: true,
    },
  })

  return NextResponse.json(updated)
}
