import { NextRequest, NextResponse } from 'next/server'
import { listCommitmentsQuerySchema } from '@/lib/validations/prediction'
import { withAuth } from '@/lib/api-middleware'
import { Prisma, PredictionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/commitments - List commitments for authenticated user
export const GET = withAuth(async (request, user) => {
  // Parse query params
  const searchParams = Object.fromEntries(request.nextUrl.searchParams)
  const query = listCommitmentsQuerySchema.parse(searchParams)

  const { page, limit, predictionId, status } = query
  const skip = (page - 1) * limit

  // Build where clause
  const where: Prisma.CommitmentWhereInput = {
    userId: user.id,
    ...(predictionId && { predictionId }),
    ...(status && {
      prediction: {
        status: status as PredictionStatus,
      },
    }),
  }

  // Execute query
  const [commitments, total] = await Promise.all([
    prisma.commitment.findMany({
      where,
      include: {
        prediction: {
          select: {
            id: true,
            claimText: true,
            status: true,
            resolveByDatetime: true,
            outcomeType: true,
          },
        },
        option: {
          select: {
            id: true,
            text: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.commitment.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return NextResponse.json({
    commitments,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  })
})
