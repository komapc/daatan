import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { env } from '@/env'
import { apiError, handleRouteError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'

const bodySchema = z.object({
  articleUrl: z.string().url(),
})

export const POST = withAuth(async (request: NextRequest) => {
  if (!env.NEWS_INDEXER_URL || !env.NEWS_INDEXER_API_KEY) {
    return apiError('News-indexer not configured', 503)
  }

  try {
    const body = bodySchema.parse(await request.json())

    const resp = await fetch(`${env.NEWS_INDEXER_URL}/match`, {
      method: 'POST',
      headers: {
        'x-api-key': env.NEWS_INDEXER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ articleUrl: body.articleUrl }),
    })

    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (error) {
    return handleRouteError(error, 'Failed to trigger news-indexer match')
  }
}, { roles: ['ADMIN'] })
