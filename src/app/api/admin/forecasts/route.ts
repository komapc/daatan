import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { type Prisma } from '@prisma/client'

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const rawLimit = parseInt(searchParams.get('limit') || '20')
  const limit = Math.min(100, Math.max(1, rawLimit))
  const search = searchParams.get('search') || ''

  const where: Prisma.PredictionWhereInput = {}
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
}, { roles: ['ADMIN', 'RESOLVER'] })
