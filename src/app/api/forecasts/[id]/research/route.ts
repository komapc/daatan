import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { apiError, handleRouteError } from '@/lib/api-error'
import { searchArticles, SearchResult } from '@/lib/utils/webSearch'
import { llmService } from '@/lib/llm'
import { SchemaType } from '@google/generative-ai'

const queryGenerationSchema = {
    type: SchemaType.OBJECT,
    properties: {
        queries: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "2-3 short, factual web search queries (3-7 words each) to find news about the forecast outcome"
        }
    },
    required: ['queries']
}

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

/**
 * Strip common English stopwords and future-tense helpers from a claim to get
 * a tighter keyword query. E.g. "The Israeli Shekel will strengthen against the
 * US Dollar by the end of February 24, 2026" → "Israeli Shekel strengthen US
 * Dollar February 2026"
 */
export function extractKeyTerms(claimText: string, resolveByDatetime: Date): string {
    const stopwords = new Set([
        'the', 'a', 'an', 'will', 'would', 'should', 'could', 'may', 'might',
        'by', 'against', 'of', 'end', 'to', 'in', 'on', 'at', 'and', 'or',
        'be', 'is', 'are', 'was', 'were', 'that', 'this', 'it', 'its',
        'have', 'has', 'had', 'do', 'does', 'did', 'not', 'for', 'with',
        'from', 'up', 'about', 'into', 'than', 'then', 'so', 'if', 'as',
    ])
    const year = resolveByDatetime.getFullYear()
    const terms = claimText
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopwords.has(w.toLowerCase()))
        .join(' ')
    // Append year only if not already present in the terms
    return terms.includes(String(year)) ? terms : `${terms} ${year}`
}

function dedup(items: SearchResult[]): SearchResult[] {
    const seen = new Set<string>()
    return items.filter(r => {
        if (seen.has(r.url)) return false
        seen.add(r.url)
        return true
    })
}

/**
 * Returns true if at least `minMatches` results contain one of the given terms
 * in their title or snippet (case-insensitive). Used to detect irrelevant results.
 */
export function hasRelevantResults(results: SearchResult[], terms: string[], minMatches = 2): boolean {
    const lowerTerms = terms.map(t => t.toLowerCase())
    let matches = 0
    for (const r of results) {
        const hay = `${r.title} ${r.snippet}`.toLowerCase()
        if (lowerTerms.some(t => hay.includes(t))) {
            matches++
            if (matches >= minMatches) return true
        }
    }
    return false
}

export const POST = withAuth(async (request: NextRequest, _user, { params }) => {
    try {
        const prediction = await prisma.prediction.findUnique({
            where: { id: params.id },
            include: { options: true }
        })

        if (!prediction) return apiError('Prediction not found', 404)

        const forecastStart = prediction.publishedAt || prediction.createdAt
        const forecastEnd = prediction.resolveByDatetime
        const now = new Date()
        const searchDateTo = forecastEnd < now ? forecastEnd : now
        const forecastStartStr = forecastStart.toISOString().split('T')[0]
        const forecastEndStr = forecastEnd.toISOString().split('T')[0]

        // Build a simplified query by stripping stopwords so we get tighter matches
        // even when the raw claim text uses future-tense phrasing that news won't use.
        const simplifiedQuery = extractKeyTerms(prediction.claimText, forecastEnd)

        // 1. Three parallel searches:
        //    a) Date-scoped with raw claim text
        //    b) Broad (no date) with raw claim text — catches older or wider coverage
        //    c) Date-scoped with simplified key-term query — targets the actual topic
        const [dated, broad, simplified] = await Promise.all([
            searchArticles(prediction.claimText, 6, { dateFrom: forecastStart, dateTo: searchDateTo })
                .catch(() => [] as SearchResult[]),
            searchArticles(prediction.claimText, 4)
                .catch(() => [] as SearchResult[]),
            searchArticles(simplifiedQuery, 6, { dateFrom: forecastStart, dateTo: searchDateTo })
                .catch(() => [] as SearchResult[]),
        ])

        let results = dedup([...simplified, ...dated, ...broad]).slice(0, 12)

        // Extract meaningful nouns from the claim to check result relevance
        const claimNouns = prediction.claimText
            .split(/\s+/)
            .filter(w => w.length > 4 && /^[A-Z]/.test(w))   // rough heuristic: capitalised words
            .map(w => w.replace(/[^\w]/g, ''))

        // 2. Fallback: if results are few OR none mention the claim's key entities,
        //    ask the LLM to generate better-targeted search queries.
        const needsFallback = results.length < 3 || !hasRelevantResults(results, claimNouns)
        if (needsFallback) {
            try {
                const qRes = await llmService.generateContent({
                    prompt: `You are helping find news articles to verify a forecast.
Forecast: "${prediction.claimText}"
Period: ${forecastStartStr} to ${forecastEndStr}

Generate 2-3 short web search queries (3-7 words each) that a journalist would use to find news confirming or denying this forecast. Use past/present tense, focus on key entities and the underlying measurable event (e.g. exchange rate, election result, price). Do NOT reuse the forecast text verbatim.`,
                    schema: queryGenerationSchema as any,
                    temperature: 0,
                })
                const { queries } = JSON.parse(qRes.text) as { queries: string[] }
                const fallbackResults = await Promise.all(
                    queries.slice(0, 3).map(q =>
                        searchArticles(q, 5, { dateFrom: forecastStart, dateTo: searchDateTo })
                            .catch(() => [] as SearchResult[])
                    )
                )
                results = dedup([...results, ...fallbackResults.flat()]).slice(0, 12)
            } catch {
                // fallback search failed — continue with what we have
            }
        }

        const context = results.length > 0
            ? results.map(r =>
                `Title: ${r.title}\nSource: ${r.source}${r.publishedDate ? ` (${r.publishedDate})` : ''}\nSnippet: ${r.snippet}\nURL: ${r.url}`
              ).join('\n\n')
            : ''

        // Include options in the prompt if MULTIPLE_CHOICE
        const optionsContext = prediction.outcomeType === 'MULTIPLE_CHOICE'
            ? `\nThis is a MULTIPLE CHOICE prediction. The available options are:\n${prediction.options.map(o => `- ID: ${o.id}, Text: "${o.text}"`).join('\n')}\nIf the outcome is 'correct', you MUST identify which specific option ID is the winner.`
            : ''

        // 3. Ask LLM to evaluate
        const prompt = `
You are an expert fact-checker and forecast resolver.
Your task is to determine the outcome of the following forecast.

Forecast Claim: ${prediction.claimText}
Outcome Type: ${prediction.outcomeType}${optionsContext}
Resolution Rules: ${prediction.resolutionRules || 'Determine outcome based on publicly available information for the relevant period.'}

Forecast Period: ${forecastStartStr} to ${forecastEndStr}
Current Date: ${now.toISOString().split('T')[0]}

${context
    ? `News Context (${results.length} articles found for the forecast period):\n${context}`
    : 'Note: Automated news search returned no results. Rely on your training knowledge for the forecast period.'}

Instructions:
1. Determine what happened during the forecast period (${forecastStartStr} to ${forecastEndStr}) with respect to the claim.
2. Use the news context above as your primary evidence. If it is insufficient or irrelevant, draw on your own knowledge of events during that period.
3. In your reasoning, explicitly list which sources or facts (from context or your own knowledge) you are using to reach your conclusion.
4. For BINARY predictions:
   - If the claim is clearly true (the event happened as stated), use 'correct'.
   - If the claim is clearly false (the event did not happen), use 'wrong'.
   - Only use 'unresolvable' if you genuinely have no reliable information for the period.
5. For MULTIPLE_CHOICE predictions:
   - If one option clearly occurred, use 'correct' AND provide correctOptionId.
   - If no option clearly matches, use 'unresolvable'.
6. Use 'void' only if the event was cancelled or the claim cannot be judged fairly by its own rules.
7. Do NOT default to 'unresolvable' simply because the news context is empty or irrelevant — use your knowledge.

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
