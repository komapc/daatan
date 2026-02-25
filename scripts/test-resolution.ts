/**
 * Test script: runs the AI research/resolution logic against a forecast by slug or inline key.
 * Usage:
 *   npx tsx scripts/test-resolution.ts ils-usd         # built-in test forecast
 *   npx tsx scripts/test-resolution.ts <slug-or-id>    # look up from DB
 */
import { PrismaClient } from '@prisma/client'
import { searchArticles, SearchResult } from '../src/lib/utils/webSearch'
import { llmService } from '../src/lib/llm'
import { SchemaType } from '@google/generative-ai'

const prisma = new PrismaClient()

// ---- Schemas ---------------------------------------------------------------

const queryGenerationSchema = {
    type: SchemaType.OBJECT,
    properties: {
        queries: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
    },
    required: ['queries']
}

const researchSchema = {
    type: SchemaType.OBJECT,
    properties: {
        outcome: { type: SchemaType.STRING, enum: ['correct', 'wrong', 'void', 'unresolvable'] },
        correctOptionId: { type: SchemaType.STRING },
        reasoning: { type: SchemaType.STRING },
        evidenceLinks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
    },
    required: ['outcome', 'reasoning', 'evidenceLinks']
}

// ---- Helpers ----------------------------------------------------------------

function extractKeyTerms(claimText: string, resolveByDatetime: Date): string {
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
    return terms.includes(String(year)) ? terms : `${terms} ${year}`
}

function dedup(items: SearchResult[]): SearchResult[] {
    const seen = new Set<string>()
    return items.filter(r => { if (seen.has(r.url)) return false; seen.add(r.url); return true })
}

function hasRelevantResults(results: SearchResult[], terms: string[], minMatches = 2): boolean {
    const lowerTerms = terms.map(t => t.toLowerCase())
    let matches = 0
    for (const r of results) {
        const hay = `${r.title} ${r.snippet}`.toLowerCase()
        if (lowerTerms.some(t => hay.includes(t))) {
            if (++matches >= minMatches) return true
        }
    }
    return false
}

// ---- Built-in test forecasts ------------------------------------------------

const INLINE_FORECASTS: Record<string, {
    claimText: string; start: string; end: string;
    outcomeType: string; resolutionRules?: string
}> = {
    'ils-usd': {
        claimText: 'The Israeli Shekel will strengthen against the US Dollar by the end of February 24, 2026',
        start: '2026-01-01',
        end: '2026-02-24',
        outcomeType: 'BINARY',
    },
}

// ---- Main -------------------------------------------------------------------

async function main() {
    const slugOrId = process.argv[2]

    let forecastStart: Date, forecastEnd: Date, claimText: string
    let outcomeType: string, resolutionRules: string | null | undefined
    let options: { id: string; text: string }[] = []
    let status = '(local test)'

    if (slugOrId && INLINE_FORECASTS[slugOrId]) {
        const f = INLINE_FORECASTS[slugOrId]
        claimText = f.claimText; forecastStart = new Date(f.start)
        forecastEnd = new Date(f.end); outcomeType = f.outcomeType
        resolutionRules = f.resolutionRules
        console.log(`\nUsing inline forecast: "${claimText}"`)
    } else {
        const lookup = slugOrId ?? 'the-israeli-shekel-will-strengthen-against-the-us-dollar-by-the-end-of-february-24-2026'
        console.log(`\nLooking up forecast: ${lookup}`)
        const prediction = await prisma.prediction.findFirst({
            where: { OR: [{ id: lookup }, { slug: lookup }] },
            include: { options: true }
        })
        if (!prediction) {
            console.error(`Forecast not found in DB. Available inline keys: ${Object.keys(INLINE_FORECASTS).join(', ')}`)
            process.exit(1)
        }
        claimText = prediction.claimText; status = prediction.status
        forecastStart = prediction.publishedAt || prediction.createdAt
        forecastEnd = prediction.resolveByDatetime; outcomeType = prediction.outcomeType
        resolutionRules = prediction.resolutionRules; options = prediction.options
    }

    console.log(`Claim    : "${claimText}"`)
    console.log(`Status   : ${status}`)
    console.log(`Period   : ${forecastStart.toISOString().split('T')[0]} → ${forecastEnd.toISOString().split('T')[0]}\n`)

    const now = new Date()
    const searchDateTo = forecastEnd < now ? forecastEnd : now
    const forecastStartStr = forecastStart.toISOString().split('T')[0]
    const forecastEndStr = forecastEnd.toISOString().split('T')[0]
    const simplifiedQuery = extractKeyTerms(claimText, forecastEnd)

    console.log(`Key-term query: "${simplifiedQuery}"`)
    console.log(`Searching news (${forecastStartStr} → ${forecastEndStr})…`)

    // Step 1: Three parallel searches
    const [dated, broad, simplified] = await Promise.all([
        searchArticles(claimText, 6, { dateFrom: forecastStart, dateTo: searchDateTo })
            .catch(e => { console.warn('  Dated search failed:', e.message); return [] as SearchResult[] }),
        searchArticles(claimText, 4)
            .catch(e => { console.warn('  Broad search failed:', e.message); return [] as SearchResult[] }),
        searchArticles(simplifiedQuery, 6, { dateFrom: forecastStart, dateTo: searchDateTo })
            .catch(e => { console.warn('  Simplified search failed:', e.message); return [] as SearchResult[] }),
    ])
    console.log(`  Dated: ${dated.length}, Broad: ${broad.length}, Simplified: ${simplified.length}`)

    let results = dedup([...simplified, ...dated, ...broad]).slice(0, 12)

    const claimNouns = claimText
        .split(/\s+/)
        .filter(w => w.length > 4 && /^[A-Z]/.test(w))
        .map(w => w.replace(/[^\w]/g, ''))

    const needsFallback = results.length < 3 || !hasRelevantResults(results, claimNouns)
    if (needsFallback) {
        console.log(`\nFallback triggered (count=${results.length}, relevant=${hasRelevantResults(results, claimNouns)}).`)
        console.log('Generating better queries via LLM…')
        const qRes = await llmService.generateContent({
            prompt: `You are helping find news articles to verify a forecast.
Forecast: "${claimText}"
Period: ${forecastStartStr} to ${forecastEndStr}

Generate 2-3 short web search queries (3-7 words each) that a journalist would use to find news confirming or denying this forecast. Use past/present tense, focus on key entities and the underlying measurable event (e.g. exchange rate, election result, price). Do NOT reuse the forecast text verbatim.`,
            schema: queryGenerationSchema as any,
            temperature: 0,
        })
        const { queries } = JSON.parse(qRes.text) as { queries: string[] }
        console.log('  LLM-generated queries:', queries)

        const fallbackResults = await Promise.all(
            queries.slice(0, 3).map(q =>
                searchArticles(q, 5, { dateFrom: forecastStart, dateTo: searchDateTo })
                    .catch(e => { console.warn(`  Query "${q}" failed:`, e.message); return [] as SearchResult[] })
            )
        )
        results = dedup([...results, ...fallbackResults.flat()]).slice(0, 12)
        console.log(`  After fallback: ${results.length} total articles`)
    }

    // Show articles
    console.log(`\n${'─'.repeat(64)}`)
    console.log(`Articles found: ${results.length}`)
    results.forEach((r, i) => {
        console.log(`\n[${i + 1}] ${r.title}`)
        console.log(`    ${r.source}${r.publishedDate ? ` (${r.publishedDate})` : ''}  |  ${r.url}`)
        console.log(`    ${r.snippet?.slice(0, 160)}…`)
    })

    const context = results.length > 0
        ? results.map(r =>
            `Title: ${r.title}\nSource: ${r.source}${r.publishedDate ? ` (${r.publishedDate})` : ''}\nSnippet: ${r.snippet}\nURL: ${r.url}`
          ).join('\n\n')
        : ''

    const optionsContext = outcomeType === 'MULTIPLE_CHOICE'
        ? `\nThis is a MULTIPLE CHOICE prediction. The available options are:\n${options.map(o => `- ID: ${o.id}, Text: "${o.text}"`).join('\n')}\nIf the outcome is 'correct', you MUST identify which specific option ID is the winner.`
        : ''

    // Step 3: LLM evaluation
    console.log(`\n${'─'.repeat(64)}`)
    console.log('Asking LLM to evaluate…\n')

    const prompt = `
You are an expert fact-checker and forecast resolver.
Your task is to determine the outcome of the following forecast.

Forecast Claim: ${claimText}
Outcome Type: ${outcomeType}${optionsContext}
Resolution Rules: ${resolutionRules || 'Determine outcome based on publicly available information for the relevant period.'}

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

    const response = await llmService.generateContent({ prompt, schema: researchSchema as any, temperature: 0 })
    const findings = JSON.parse(response.text)

    console.log('Result:')
    console.log(JSON.stringify(findings, null, 2))

    await prisma.$disconnect()
}

main().catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
})
