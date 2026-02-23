import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/approvals — list PENDING_APPROVAL forecasts
export const GET = withAuth(async (req) => {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const rawLimit = parseInt(searchParams.get('limit') || '20')
    const limit = Math.min(100, Math.max(1, rawLimit))

    const where = { status: 'PENDING_APPROVAL' as const }

    const [predictions, total] = await Promise.all([
        prisma.prediction.findMany({
            where,
            include: {
                author: { select: { name: true, username: true, email: true, image: true, isBot: true } },
                _count: { select: { commitments: true, comments: true } },
            },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.prediction.count({ where }),
    ])

    return NextResponse.json({ predictions, total, pages: Math.ceil(total / limit) })
}, { roles: ['ADMIN', 'RESOLVER', 'APPROVER'] })
