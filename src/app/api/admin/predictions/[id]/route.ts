import { NextResponse } from 'next/server'
import { withRole } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PENDING', 'RESOLVED_CORRECT', 'RESOLVED_WRONG', 'VOID', 'UNRESOLVABLE']),
})

export const PATCH = withRole(['ADMIN', 'RESOLVER'], async (req, { params }) => {
  const { id } = params
  const body = await req.json()
  
  const result = updateStatusSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  
  const prediction = await prisma.prediction.update({
    where: { id },
    data: { status: result.data.status },
  })
  
  return NextResponse.json(prediction)
})

// Soft-delete a prediction (admin only)
export const DELETE = withRole(['ADMIN'], async (req, { params }) => {
  const { id } = params

  await prisma.prediction.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true })
})
