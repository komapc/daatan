import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateUserSchema = z.object({
  role: z.enum(['USER', 'RESOLVER', 'ADMIN']),
})

export const PATCH = withAuth(async (req, user, { params }) => {
  const { id } = params

  // Prevent self-demotion
  if (user.id === id) {
    return NextResponse.json({ error: 'Cannot modify your own roles' }, { status: 400 })
  }

  const body = await req.json()

  const result = updateUserSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const { role } = result.data

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { role },
    select: {
      id: true,
      name: true,
      username: true,
      emailNotifications: true,
      isPublic: true,
      role: true,
      rs: true,
      cuAvailable: true,
      isBot: true,
    }
  })

  return NextResponse.json(updatedUser)
}, { roles: ['ADMIN'] })
