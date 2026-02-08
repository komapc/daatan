import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listCommitmentsQuerySchema } from '@/lib/validations/prediction'
import { apiError, handleRouteError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

const getPrisma = async () => {
  const { prisma } = await import('@/lib/prisma')
  return prisma
}

// GET /api/commitments - List commitments for authenticated user
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma()
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401)
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      predictionId: searchParams.get('predictionId') || undefined,
      status: searchParams.get('status') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    }

    const { predictionId, status, page, limit } = listCommitmentsQuerySchema.parse(queryParams)

    // Build where clause
    const where: any = {
      userId: session.user.id,
    }

    if (predictionId) {
      where.predictionId = predictionId
    }

    if (status) {
      where.prediction = {
        status,
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Query commitments with pagination
    const [commitments, total] = await Promise.all([
      prisma.commitment.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
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
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
        },
      }),
      prisma.commitment.count({ where }),
    ])

    // Calculate pagination metadata
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
    return handleRouteError(error, 'Failed to fetch commitments')
  }
}
