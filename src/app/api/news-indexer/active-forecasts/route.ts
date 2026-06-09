import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/env'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-news-indexer-secret')
  if (!env.NEWS_INDEXER_SECRET || !secret || secret !== env.NEWS_INDEXER_SECRET) {
    return apiError('Unauthorized', 401)
  }

  const predictions = await prisma.prediction.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, claimText: true },
  })

  return NextResponse.json(
    predictions.map(p => ({ id: p.id, question: p.claimText })),
  )
}
