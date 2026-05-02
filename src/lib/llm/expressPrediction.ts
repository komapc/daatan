import { SchemaType, type Schema } from '@google/generative-ai'
import { getPromptTemplate, fillPrompt } from './bedrock-prompts'
import { llmService } from './index'
import { searchArticles, type SearchResult } from '../utils/webSearch'
import { searchArticlesMultilingual } from '../utils/multilingualSearch'
import { oracleSearch } from '../services/oracleSearch'
import { fetchUrlContent } from '../utils/scraper'
import { hashUrl } from '../utils/hash'
import { createLogger } from '@/lib/logger'
import { STANDARD_TAGS } from '@/lib/constants'
import { checkContent } from '../services/moderation'

const log = createLogger('express-prediction')

export const expressPredictionSchema: Schema = {
  description: "Structured prediction generated from user's casual input",
  type: SchemaType.OBJECT,
  properties: {
    claimText: {
      type: SchemaType.STRING,
      description: "Clear, testable prediction statement",
    },
    resolveByDatetime: {
      type: SchemaType.STRING,
      description: "ISO 8601 datetime when prediction should be resolved",
    },
    detailsText: {
      type: SchemaType.STRING,
      description: "2-3 sentence summary of current situation based on articles",
    },
    tags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "List of relevant tags (1-3)",
    },
    resolutionRules: {
      type: SchemaType.STRING,
      description: "Specific criteria for resolution",
    },
    outcomeType: {
      type: SchemaType.STRING,
      description: "BINARY for yes/no predictions, MULTIPLE_CHOICE when multiple distinct outcomes are possible (e.g. 'who will win', 'which team')",
    },
    options: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "For MULTIPLE_CHOICE only: 2-10 distinct outcome options. Empty array for BINARY.",
    },
    probabilitySuggestion: {
      type: SchemaType.NUMBER,
      description: "AI's suggested probability (0-100) based on current context",
    },
    probabilityReasoning: {
      type: SchemaType.STRING,
      description: "One sentence explanation for the probability suggestion",
    },
  },
  required: ["claimText", "resolveByDatetime", "detailsText", "tags", "resolutionRules", "outcomeType", "options", "probabilitySuggestion", "probabilityReasoning"],
}

export const guessChancesSchema: Schema = {
  description: "Suggested probability and reasoning for a forecast",
  type: SchemaType.OBJECT,
  properties: {
    probability: {
      type: SchemaType.NUMBER,
      description: "Suggested probability (0 to 100)",
    },
    reasoning: {
      type: SchemaType.STRING,
      description: "Brief explanation for the suggested probability",
    },
  },
  required: ["probability", "reasoning"],
}

export interface ExpressPredictionResult {
  claimText: string
  resolveByDatetime: string
  detailsText: string
  tags: string[]
  resolutionRules: string
  outcomeType: 'BINARY' | 'MULTIPLE_CHOICE'
  options: string[] // Non-empty for MULTIPLE_CHOICE
  probabilitySuggestion: number
  probabilityReasoning: string
  newsAnchor: {
    url: string
    urlHash: string
    title: string
    snippet: string
    source?: string
    publishedAt?: Date
  } | null
  additionalLinks: Array<{
    url: string
    title: string
  }>
}

/** Shape of the JSON object returned by the LLM (matches expressPredictionSchema). */
interface ParsedPrediction {
  claimText: string
  resolveByDatetime: string
  detailsText: string
  tags: string[]
  resolutionRules: string
  outcomeType: 'BINARY' | 'MULTIPLE_CHOICE'
  options: string[]
  probabilitySuggestion: number
  probabilityReasoning: string
}

export function getFiveYearsFromNow(now: Date) {
  const d = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate())
  return {
    iso: d.toISOString().split('T')[0] + 'T23:59:59Z',
    human: d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  }
}

export async function generateExpressPrediction(
  userInput: string,
  onProgress?: (stage: string, data?: Record<string, unknown>) => void,
  skipSources?: boolean
): Promise<ExpressPredictionResult> {
  // Proactive Content Moderation
  onProgress?.('checking', { message: 'Checking content…' })
  const moderation = await checkContent(userInput, 'forecast')
  if (moderation.isOffensive) {
    throw new Error(`OFFENSIVE_INPUT: ${moderation.reason}`)
  }

  // Source-free path: skip web search entirely
  if (skipSources) {
    onProgress?.('analyzing', { message: 'AI is drafting your forecast…' })

    const now = new Date()
    const currentYear = now.getFullYear()
    const endOfYear = `${currentYear}-12-31T23:59:59Z`
    const endOfYearHuman = `December 31, ${currentYear}`
    const { iso: fiveYearsFromNow, human: fiveYearsFromNowHuman } = getFiveYearsFromNow(now)

    const articlesText = `[User Input]\n${userInput}`
    const template = await getPromptTemplate('express-prediction')
    const prompt = fillPrompt(template, {
      userInput,
      articlesText,
      endOfYear,
      endOfYearHuman,
      fiveYearsFromNow,
      fiveYearsFromNowHuman,
      currentYear,
      currentDate: now.toISOString().split('T')[0],
      STANDARD_TAGS: STANDARD_TAGS.join(', '),
    })

    let prediction: ParsedPrediction
    try {
      const result = await llmService.generateContent({
        prompt,
        schema: expressPredictionSchema,
        temperature: 0.2,
      })
      prediction = JSON.parse(result.text)
      prediction.claimText = humanizeISODates(prediction.claimText)
      onProgress?.('prediction_formed', {
        message: 'Forecast drafted — finalising…',
        preview: {
          claim: prediction.claimText,
          resolveBy: prediction.resolveByDatetime,
          outcomeType: prediction.outcomeType,
          options: prediction.options || [],
        },
      })
    } catch (error) {
      log.error({ err: error }, 'Failed to generate source-free express prediction')
      throw error
    }

    const validOutcomeTypes = ['BINARY', 'MULTIPLE_CHOICE'] as const
    if (!validOutcomeTypes.includes(prediction.outcomeType as typeof validOutcomeTypes[number])) {
      prediction.outcomeType = 'BINARY'
      prediction.options = []
    }
    if (prediction.outcomeType === 'MULTIPLE_CHOICE') {
      prediction.options = (prediction.options || []).filter(o => o.trim())
      if (prediction.options.length < 2) {
        prediction.outcomeType = 'BINARY'
        prediction.options = []
      }
    } else {
      prediction.options = []
    }

    onProgress?.('finalizing', { message: 'Almost done — preparing your forecast for review…' })

    return { ...prediction, newsAnchor: null, additionalLinks: [] }
  }

  const isUrl = /^https?:\/\/[^\s]+$/i.test(userInput.trim())

  let searchResults: SearchResult[]
  let primaryArticle: SearchResult | null = null

  if (isUrl) {
    // URL flow: fetch article, extract topic, search for related articles
    const url = userInput.trim()
    onProgress?.('searching', { message: 'Fetching article content...' })

    let articleContent: string
    try {
      articleContent = await fetchUrlContent(url)
    } catch {
      log.warn({ url }, 'Failed to fetch URL content, falling back to search')
      articleContent = ''
    }

    if (!articleContent) {
      // Fallback: use the URL as a search query
      onProgress?.('searching', { message: 'Searching for relevant articles...' })
      searchResults = await oracleSearch(url, 5) ?? await searchArticles(url, 5)
      if (searchResults.length === 0) throw new Error('NO_ARTICLES_FOUND')
    } else {
      // Extract topic from article content using LLM
      onProgress?.('searching', { message: 'Reading article and extracting topic...' })

      let topic: string
      try {
        const template = await getPromptTemplate('topic-extraction')
        const prompt = fillPrompt(template, { articleContent: articleContent.substring(0, 3000) })
        const extractResult = await llmService.generateContent({
          prompt,
          temperature: 0,
        })
        topic = extractResult.text.trim().replace(/^["']|["']$/g, '')
      } catch (error) {
        log.warn({ err: error }, 'Failed to extract topic from article, using URL as search')
        topic = url
      }

      log.info({ url, topic }, 'Extracted topic from URL')

      // Build primary article from fetched content
      const domain = extractDomainFromUrl(url)
      // Extract title: first meaningful line from content (before any long text)
      const titleMatch = articleContent.match(/^(.{10,120}?)(?:\s{2,}|\.\s)/)
      primaryArticle = {
        title: titleMatch ? titleMatch[1] : topic,
        url,
        snippet: articleContent.substring(0, 500),
        source: domain,
      }

      // Search for related articles using the extracted topic
      onProgress?.('searching', { message: `Finding related articles for: "${topic}"` })

      try {
        searchResults = await oracleSearch(topic, 5) ?? await searchArticlesMultilingual(topic, 5)
      } catch {
        searchResults = []
      }

      // Remove the original URL from search results if it appeared
      searchResults = searchResults.filter(r => r.url !== url)

      // Prepend the primary article
      searchResults = [primaryArticle, ...searchResults.slice(0, 4)]
    }
  } else {
    // Normal text flow: search for articles
    onProgress?.('searching', { message: 'Searching for relevant articles...' })
    searchResults = await oracleSearch(userInput, 5) ?? await searchArticlesMultilingual(userInput, 5)

    if (searchResults.length === 0) {
      throw new Error('NO_ARTICLES_FOUND')
    }
  }

  // Build source summary like "CNN×2, Bloomberg, BBC"
  const sourceCounts = new Map<string, number>()
  for (const r of searchResults) {
    const name = r.source || 'Unknown'
    sourceCounts.set(name, (sourceCounts.get(name) || 0) + 1)
  }
  const sourceSummary = Array.from(sourceCounts.entries())
    .map(([name, count]) => count > 1 ? `${name}×${count}` : name)
    .join(', ')

  onProgress?.('found_articles', {
    count: searchResults.length,
    sources: sourceSummary,
    message: `Found ${searchResults.length} sources (${sourceSummary})`
  })

  // Step 2: Prepare articles for LLM
  const articlesText = searchResults
    .map((article, i) => {
      // For the primary fetched article, include more content
      const snippet = (article === primaryArticle && article.snippet.length > 200)
        ? article.snippet
        : article.snippet
      return `
[Article ${i + 1}]
Title: ${article.title}
Source: ${article.source || 'Unknown'}
Published: ${article.publishedDate || 'Unknown'}
Snippet: ${snippet}
URL: ${article.url}
`
    })
    .join('\n')

  onProgress?.('analyzing', {
    message: `AI is reading ${searchResults.length} article${searchResults.length !== 1 ? 's' : ''} and drafting your forecast…`,
    articleCount: searchResults.length,
  })

  // Step 3: Generate prediction with LLM
  const now = new Date()
  const currentYear = now.getFullYear()
  const endOfYear = `${currentYear}-12-31T23:59:59Z`
  const endOfYearHuman = `December 31, ${currentYear}`
  const { iso: fiveYearsFromNow, human: fiveYearsFromNowHuman } = getFiveYearsFromNow(now)

  const template = await getPromptTemplate('express-prediction')
  const prompt = fillPrompt(template, {
    userInput,
    articlesText,
    endOfYear,
    endOfYearHuman,
    fiveYearsFromNow,
    fiveYearsFromNowHuman,
    currentYear,
    currentDate: now.toISOString().split('T')[0],
    STANDARD_TAGS: STANDARD_TAGS.join(', '),
  })

  let prediction: ParsedPrediction
  try {
    const result = await llmService.generateContent({
      prompt,
      schema: expressPredictionSchema,
      temperature: 0.2, // Slightly creative but structured
    })
    prediction = JSON.parse(result.text)

    // Post-process: replace any ISO timestamps that leaked into claimText
    prediction.claimText = humanizeISODates(prediction.claimText)
  } catch (error) {
    log.error({ err: error }, 'Failed to generate express prediction')
    throw error
  }

  // Normalize outcomeType — fall back to BINARY for unrecognized values
  const validOutcomeTypes = ['BINARY', 'MULTIPLE_CHOICE'] as const
  if (!validOutcomeTypes.includes(prediction.outcomeType as typeof validOutcomeTypes[number])) {
    prediction.outcomeType = 'BINARY'
    prediction.options = []
  }

  // Ensure MULTIPLE_CHOICE has at least 2 options, otherwise fall back to BINARY
  if (prediction.outcomeType === 'MULTIPLE_CHOICE') {
    prediction.options = (prediction.options || []).filter(o => o.trim())
    if (prediction.options.length < 2) {
      prediction.outcomeType = 'BINARY'
      prediction.options = []
    }
  } else {
    prediction.options = []
  }

  onProgress?.('prediction_formed', {
    message: 'Forecast drafted — attaching sources…',
    preview: {
      claim: prediction.claimText,
      resolveBy: prediction.resolveByDatetime,
      outcomeType: prediction.outcomeType,
      options: prediction.options,
    }
  })

  // Step 4: Select best article as NewsAnchor
  const bestArticle = searchResults[0] // Most relevant (first result)

  // Step 5: Prepare additional links
  const additionalLinks = searchResults.slice(1, 4).map(article => ({
    url: article.url,
    title: article.title
  }))

  onProgress?.('finalizing', { message: 'Almost done — preparing your forecast for review…' })

  return {
    ...prediction,
    newsAnchor: {
      url: bestArticle.url,
      urlHash: hashUrl(bestArticle.url),
      title: bestArticle.title,
      snippet: bestArticle.snippet,
      source: bestArticle.source,
      publishedAt: bestArticle.publishedDate ? new Date(bestArticle.publishedDate) : undefined
    },
    additionalLinks
  }
}

/**
 * Specifically guess the chances of a prediction based on provided sources.
 */
export async function guessChances(
  claimText: string,
  detailsText: string,
  articles: Array<{ title: string; source: string; snippet: string }>
): Promise<{ probability: number; reasoning: string }> {
  const articlesText = articles
    .map((article, i) => `
[Article ${i + 1}]
Title: ${article.title}
Source: ${article.source}
Snippet: ${article.snippet}
`).join('\n')

  const template = await getPromptTemplate('guess-chances')
  const prompt = fillPrompt(template, {
    claimText,
    detailsText,
    articlesText,
  })

  try {
    const result = await llmService.generateContent({
      prompt,
      schema: guessChancesSchema,
      temperature: 0,
    })
    return JSON.parse(result.text)
  } catch (error) {
    log.error({ err: error }, 'Failed to guess chances')
    throw error
  }
}

export function extractDomainFromUrl(url: string): string {
  try {
    const domain = new URL(url).hostname
    return domain.replace('www.', '')
  } catch {
    return 'Unknown'
  }
}

/**
 * Replace ISO 8601 timestamps (e.g. "2026-12-31T23:59:59Z") in a string
 * with a human-readable format like "December 31, 2026".
 * Uses the date portion of the ISO string directly to avoid timezone shifts.
 */
export function humanizeISODates(text: string): string {
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  // Matches ISO 8601 date-time strings like 2026-12-31T23:59:59Z or 2026-12-31T23:59:59.000Z
  return text.replace(
    /(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,
    (_match, year: string, month: string, day: string) => {
      const monthIndex = parseInt(month, 10) - 1
      if (monthIndex < 0 || monthIndex > 11) return _match
      return `${MONTHS[monthIndex]} ${parseInt(day, 10)}, ${year}`
    }
  )
}
