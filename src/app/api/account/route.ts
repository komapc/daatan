import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const DELETE = withAuth(async (_request, user) => {
  await prisma.user.delete({ where: { id: user.id } })
  return NextResponse.json({ ok: true })
})
