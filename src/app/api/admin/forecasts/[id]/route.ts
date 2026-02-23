import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PENDING', 'PENDING_APPROVAL', 'RESOLVED_CORRECT', 'RESOLVED_WRONG', 'VOID', 'UNRESOLVABLE']),
})

export const PATCH = withAuth(async (req, user, { params }) => {
  const { id } = params
  const body = await req.json()

  const result = updateStatusSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  // Approvers can only transition PENDING_APPROVAL → ACTIVE
  if (user.role === 'APPROVER') {
    const prediction = await prisma.prediction.findUnique({ where: { id }, select: { status: true } })
    if (!prediction) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (prediction.status !== 'PENDING_APPROVAL' || result.data.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Approvers can only approve pending forecasts' }, { status: 403 })
    }
  }

  const prediction = await prisma.prediction.update({
    where: { id },
    data: { status: result.data.status }
  })

  return NextResponse.json(prediction)
}, { roles: ['ADMIN', 'RESOLVER', 'APPROVER'] })

// Delete a prediction (admin only)
export const DELETE = withAuth(async (_req, _user, { params }) => {
  const { id } = params

  await prisma.prediction.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}, { roles: ['ADMIN'] })
