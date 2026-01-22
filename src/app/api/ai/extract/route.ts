import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fetchUrlContent } from '@/lib/utils/scraper'
import { extractPrediction } from '@/lib/llm/gemini'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url, text } = await req.json()

    let contentToProcess = text

    if (url && !text) {
      contentToProcess = await fetchUrlContent(url)
    }

    if (!contentToProcess) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    const result = await extractPrediction(contentToProcess)
    
    // If we fetched from a URL, ensure it's in the response
    if (url && !result.sourceUrl) {
      result.sourceUrl = url
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Extraction API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
