import { NextResponse } from 'next/server'
import { withRole } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

const updateUserSchema = z.object({
  role: z.enum(['USER', 'RESOLVER', 'ADMIN']),
})

export const PATCH = withRole(['ADMIN'], async (req, { params }) => {
  const { id } = params
  const session = await getServerSession(authOptions)

  // Prevent self-demotion
  if (session?.user?.id === id) {
    return NextResponse.json({ error: 'Cannot modify your own roles' }, { status: 400 })
  }

  const body = await req.json()
  
  const result = updateUserSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  
  const { role } = result.data
  
  const user = await prisma.user.update({
    where: { id },
    data: { role }
  })
  
  return NextResponse.json(user)
})
