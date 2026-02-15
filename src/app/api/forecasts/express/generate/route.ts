import { generateExpressPrediction } from '@/lib/llm/expressPrediction'
import { z } from 'zod'
import { apiError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'

const generateSchema = z.object({
  userInput: z.string().min(5).max(200),
})

export const POST = withAuth(async (request) => {
  const body = await request.json()
  const { userInput } = generateSchema.parse(body)

  // Check if GEMINI_API_KEY is configured
  if (!process.env.GEMINI_API_KEY) {
    return apiError('Service not configured. Please contact administrator.', 503)
  }

  // Check if Serper API is configured
  if (!process.env.SERPER_API_KEY) {
    return apiError('Search service not configured. Please contact administrator.', 503)
  }

  // Create a readable stream for progress updates
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Progress callback
        const onProgress = (stage: string, data?: Record<string, unknown>) => {
          const message = JSON.stringify({ stage, data }) + '\n'
          controller.enqueue(encoder.encode(message))
        }

        // Generate prediction with progress updates
        const result = await generateExpressPrediction(userInput, onProgress)

        // Send final result
        const finalMessage = JSON.stringify({ stage: 'complete', data: result }) + '\n'
        controller.enqueue(encoder.encode(finalMessage))
        controller.close()
      } catch (error) {
        if (error instanceof Error && error.message === 'NO_ARTICLES_FOUND') {
          const errorMessage = JSON.stringify({
            stage: 'error',
            error: 'NO_ARTICLES_FOUND',
            message: "Couldn't find relevant articles. Try rephrasing your prediction or being more specific."
          }) + '\n'
          controller.enqueue(encoder.encode(errorMessage))
        } else {
          const errorMessage = JSON.stringify({
            stage: 'error',
            error: 'GENERATION_FAILED',
            message: 'Failed to generate prediction'
          }) + '\n'
          controller.enqueue(encoder.encode(errorMessage))
        }
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
})
