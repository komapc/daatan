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
      { claimText: { contains: search, mode: 'insensitive' } },
      { author: { name: { contains: search, mode: 'insensitive' } } },
      { author: { email: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const [predictions, total] = await Promise.all([
    prisma.prediction.findMany({
      where,
      include: {
        author: { select: { name: true, email: true } },
        _count: { select: { commitments: true, comments: true } }
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.prediction.count({ where })
  ])

  return NextResponse.json({ predictions, total, pages: Math.ceil(total / limit) })
})
