import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fetchUrlContent } from '@/lib/utils/scraper'
import { extractPrediction } from '@/lib/llm/gemini'
import { apiError, handleRouteError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return apiError('Unauthorized', 401)
    }

    const { url, text } = await req.json()

    let contentToProcess = text

    if (url && !text) {
      contentToProcess = await fetchUrlContent(url)
    }

    if (!contentToProcess) {
      return apiError('No content provided', 400)
    }

    const result = await extractPrediction(contentToProcess)
    
    // If we fetched from a URL, ensure it's in the response
    if (url && !result.sourceUrl) {
      result.sourceUrl = url
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    return handleRouteError(error, 'Extraction failed')
  }
}
