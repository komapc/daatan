import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const grantSchema = z.object({
  amount: z.number().int().min(1).max(10000),
  note: z.string().max(200).optional(),
})

export const POST = withAuth(async (req) => {
  const body = await req.json()
  const result = grantSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const { amount, note } = result.data
  const grantNote = note ?? `Admin bulk grant of ${amount} CU`

  const users = await prisma.user.findMany({
    where: { isBot: false },
    select: { id: true, cuAvailable: true },
  })

  if (users.length === 0) {
    return NextResponse.json({ granted: 0 })
  }

  await prisma.$transaction(
    users.flatMap(u => [
      prisma.cuTransaction.create({
        data: {
          userId: u.id,
          type: 'ADMIN_ADJUSTMENT',
          amount,
          balanceAfter: u.cuAvailable + amount,
          note: grantNote,
        },
      }),
      prisma.user.update({
        where: { id: u.id },
        data: { cuAvailable: { increment: amount } },
      }),
    ]),
  )

  return NextResponse.json({ granted: users.length })
}, { roles: ['ADMIN'] })
