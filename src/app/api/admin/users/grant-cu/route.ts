import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { z } from 'zod'
import { grantCuToAllUsers } from '@/lib/services/user'

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

  const granted = await grantCuToAllUsers(amount, grantNote)

  return NextResponse.json({ granted })
}, { roles: ['ADMIN'] })
