import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { deleteAccount } from '@/lib/services/user'

export const DELETE = withAuth(async (_request, user) => {
  await deleteAccount(user.id)
  return NextResponse.json({ ok: true })
})
