import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createForecastSchema, listForecastsQuerySchema } from '@/lib/validations/forecast'
import { ForecastStatus } from '@prisma/client'

// GET /api/forecasts - List forecasts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const query = listForecastsQuerySchema.parse({
      status: searchParams.get('status') || undefined,
      type: searchParams.get('type') || undefined,
      creatorId: searchParams.get('creatorId') || undefined,
      page: searchParams.get('page') || 1,
      limit: searchParams.get('limit') || 20,
    })

    const where = {
      ...(query.status && { status: query.status as ForecastStatus }),
      ...(query.type && { type: query.type }),
      ...(query.creatorId && { creatorId: query.creatorId }),
      // Don't show drafts unless filtering by creator
      ...(!query.creatorId && !query.status && { status: { not: 'DRAFT' as ForecastStatus } }),
    }

    const [forecasts, total] = await Promise.all([
      prisma.forecast.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              username: true,
              image: true,
            },
          },
          options: {
            orderBy: { displayOrder: 'asc' },
          },
          _count: {
            select: { votes: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.forecast.count({ where }),
    ])

    return NextResponse.json({
      forecasts,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    })
  } catch (error) {
    console.error('Error fetching forecasts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch forecasts' },
      { status: 500 }
    )
  }
}

// POST /api/forecasts - Create a new forecast
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const data = createForecastSchema.parse(body)

    // Validate binary forecasts have exactly 2 options
    if (data.type === 'BINARY' && data.options.length !== 2) {
      return NextResponse.json(
        { error: 'Binary forecasts must have exactly 2 options' },
        { status: 400 }
      )
    }

    const forecast = await prisma.forecast.create({
      data: {
        creatorId: session.user.id,
        title: data.title,
        text: data.text,
        sourceArticles: data.sourceArticles,
        dueDate: new Date(data.dueDate),
        type: data.type,
        status: data.status,
        options: {
          create: data.options.map((option, index) => ({
            text: option.text,
            displayOrder: index,
          })),
        },
      },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(forecast, { status: 201 })
  } catch (error) {
    console.error('Error creating forecast:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create forecast' },
      { status: 500 }
    )
  }
}

