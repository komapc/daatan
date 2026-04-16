import { guessChances } from '@/lib/llm/expressPrediction'
import { getOracleProbability } from '@/lib/services/oracle'
import { z } from 'zod'
import { handleRouteError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { NextResponse } from 'next/server'

const guessSchema = z.object({
  claimText: z.string().min(5),
  detailsText: z.string(),
  articles: z.array(z.object({
    title: z.string(),
    source: z.string(),
    snippet: z.string(),
  })),
})

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { claimText, detailsText, articles } = guessSchema.parse(body)

    const oracleProb = await getOracleProbability(claimText)
    if (oracleProb !== null) {
      return NextResponse.json({
        probability: Math.round(oracleProb * 100),
        reasoning: 'TruthMachine Oracle (calibrated multi-source estimate)',
      })
    }

    const result = await guessChances(claimText, detailsText, articles)
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to guess chances')
  }
})
