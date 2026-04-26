import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { softDeleteComment } from '@/lib/services/comment'

export const DELETE = withAuth(async (_req, _user, { params }) => {
  const { id } = params

  await softDeleteComment(id)

  return NextResponse.json({ success: true })
}, { roles: ['ADMIN', 'RESOLVER'] })
