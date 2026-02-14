import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listCommitmentsQuerySchema } from '@/lib/validations/prediction'
import { apiError, handleRouteError } from '@/lib/api-error'
import { Prisma, PredictionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/commitments - List commitments for authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const query = listCommitmentsQuerySchema.parse(searchParams)

    const { page, limit, predictionId, status } = query
    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.CommitmentWhereInput = {
      userId: session.user.id,
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

  } catch (error) {
    return handleRouteError(error, 'Failed to list commitments')
  }
}
