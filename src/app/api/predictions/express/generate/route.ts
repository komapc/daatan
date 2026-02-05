import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { generateExpressPrediction } from '@/lib/llm/expressPrediction'
import { z } from 'zod'

const generateSchema = z.object({
  userInput: z.string().min(5).max(200),
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userInput } = generateSchema.parse(body)

    // Check if GEMINI_API_KEY is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured')
      return NextResponse.json(
        { error: 'Service not configured. Please contact administrator.' },
        { status: 503 }
      )
    }

    // Generate prediction using LLM + web search
    const result = await generateExpressPrediction(userInput)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'NO_ARTICLES_FOUND') {
      return NextResponse.json(
        { 
          error: 'NO_ARTICLES_FOUND',
          message: "Couldn't find relevant articles. Try rephrasing your prediction or being more specific."
        },
        { status: 404 }
      )
    }

    console.error('Express prediction generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    )
  }
}
