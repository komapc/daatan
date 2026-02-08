import { NextResponse } from 'next/server'
import { withRole } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const GET = withRole(['ADMIN'], async (req) => {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''
  
  const where: any = {}
  if (search) {
    where.OR = [
      { text: { contains: search, mode: 'insensitive' } },
      { author: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      include: {
        author: { select: { name: true, email: true } },
        prediction: { select: { claimText: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.comment.count({ where })
  ])

  return NextResponse.json({ comments, total, pages: Math.ceil(total / limit) })
})
