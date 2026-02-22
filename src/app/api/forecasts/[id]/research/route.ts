import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { apiError, handleRouteError } from '@/lib/api-error'
import { searchArticles } from '@/lib/utils/webSearch'
import { llmService } from '@/lib/llm'
import { SchemaType } from '@google/generative-ai'

const researchSchema = {
    type: SchemaType.OBJECT,
    properties: {
        outcome: {
            type: SchemaType.STRING,
            enum: ['correct', 'wrong', 'void', 'unresolvable'],
            description: "The suggested resolution outcome"
        },
        correctOptionId: {
            type: SchemaType.STRING,
            description: "The ID of the correct option if the prediction is MULTIPLE_CHOICE and outcome is 'correct'"
        },
        reasoning: {
            type: SchemaType.STRING,
            description: "Brief explanation of why this outcome was chosen based on the evidence"
        },
        evidenceLinks: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "List of URLs found that support the resolution"
        }
    },
    required: ['outcome', 'reasoning', 'evidenceLinks']
}

export const POST = withAuth(async (request: NextRequest, _user, { params }) => {
    try {
        const prediction = await prisma.prediction.findUnique({
            where: { id: params.id },
            include: { options: true }
        })

        if (!prediction) return apiError('Prediction not found', 404)

        // 1. Search for latest news on the claim
        const searchQuery = `"${prediction.claimText}" result status`
        const results = await searchArticles(searchQuery, 5)

        const context = results.map(r => `Title: ${r.title}\nSource: ${r.source}\nSnippet: ${r.snippet}\nURL: ${r.url}`).join('\n\n')

        // Include options in the prompt if MULTIPLE_CHOICE
        const optionsContext = prediction.outcomeType === 'MULTIPLE_CHOICE'
            ? `\nThis is a MULTIPLE CHOICE prediction. The available options are:\n${prediction.options.map(o => `- ID: ${o.id}, Text: "${o.text}"`).join('\n')}\nIf the outcome is 'correct', you MUST identify which specific option ID is the winner.`
            : ''

        // 2. Ask LLM to evaluate
        const prompt = `
You are an expert fact-checker and forecast resolver. 
Your task is to determine the outcome of the following forecast based on the provided news context.

Forecast Claim: ${prediction.claimText}
Outcome Type: ${prediction.outcomeType}${optionsContext}
Resolution Rules: ${prediction.resolutionRules || 'Use general common sense and standard verification principles.'}

Current Date: ${new Date().toISOString().split('T')[0]}

News Context:
${context}

Instructions:
1. Compare the claim against the news evidence.
2. For BINARY predictions:
   - If the claim is clearly true (happened), use 'correct'.
   - If the claim is clearly false (didn't happen), use 'wrong'.
3. For MULTIPLE_CHOICE predictions:
   - If one of the options has clearly happened/won, use 'outcome: correct' AND provide that option's correctOptionId.
   - If 'Other' or no option matches, use 'unresolvable'.
4. If the event was cancelled or rules make it impossible to judge fairly, use 'void'.
5. If news is inconclusive or doesn't mention the specific event yet, use 'unresolvable'.

Return your findings in JSON format.
`

        const response = await llmService.generateContent({
            prompt,
            schema: researchSchema as any,
            temperature: 0
        })

        const findings = JSON.parse(response.text)
        return NextResponse.json(findings)
    } catch (err) {
        return handleRouteError(err, 'Failed to perform AI research')
    }
}, { roles: ['RESOLVER', 'ADMIN'] })
