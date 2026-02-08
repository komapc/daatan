import { NextResponse } from 'next/server'
import { withRole } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const DELETE = withRole(['ADMIN'], async (req, { params }) => {
  const { id } = params
  
  // Soft delete
  await prisma.comment.update({
    where: { id },
    data: { deletedAt: new Date() }
  })
  
  return NextResponse.json({ success: true })
})
