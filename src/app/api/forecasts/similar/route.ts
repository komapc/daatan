import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api-error'
import { prisma } from '@/lib/prisma'
import { findSimilarForecasts } from '@/lib/services/forecast'

export const dynamic = 'force-dynamic'

// GET /api/forecasts/similar?id=<id>&limit=3
// GET /api/forecasts/similar?q=<text>&tags=<csv>&limit=3
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id') || undefined
    const q = searchParams.get('q') || ''
    const tagsParam = searchParams.get('tags') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '3'), 10)

    let claimText = q
    let tags: string[] = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : []

    if (id) {
      const forecast = await prisma.prediction.findUnique({
        where: { id },
        select: {
          claimText: true,
          tags: { select: { name: true } },
        },
      })
      if (!forecast) return NextResponse.json({ similar: [] })
      claimText = forecast.claimText
      tags = forecast.tags.map(t => t.name)
    }

    if (!claimText || claimText.length < 5) {
      return NextResponse.json({ similar: [] })
    }

    const similar = await findSimilarForecasts({ claimText, tags, excludeId: id, limit })
    return NextResponse.json({ similar })
  } catch (error) {
    return handleRouteError(error, 'Failed to find similar forecasts')
  }
}
