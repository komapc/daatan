import { SchemaType, type Schema } from '@google/generative-ai'
import { getExpressPredictionPrompt } from './prompts'
import { llmService } from './index'
import { searchArticles, type SearchResult } from '../utils/webSearch'
import crypto from 'crypto'

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
    domain: {
      type: SchemaType.STRING,
      description: "Category (DEPRECATED - just use 'General')",
    },
  },
  required: ["claimText", "resolveByDatetime", "detailsText", "tags", "resolutionRules"],
}

export interface ExpressPredictionResult {
  claimText: string
  resolveByDatetime: string
  detailsText: string
  domain: string // Keep for backward compat
  tags: string[]
  resolutionRules: string
  newsAnchor: {
    url: string
    urlHash: string
    title: string
    snippet: string
    source?: string
    publishedAt?: Date
  }
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
  domain?: string
}

export async function generateExpressPrediction(
  userInput: string,
  onProgress?: (stage: string, data?: Record<string, unknown>) => void
): Promise<ExpressPredictionResult> {
  // Step 1: Search for relevant articles
  onProgress?.('searching', { message: 'Searching for relevant articles...' })

  const searchResults: SearchResult[] = await searchArticles(userInput, 5)

  if (searchResults.length === 0) {
    throw new Error('NO_ARTICLES_FOUND')
  }

  onProgress?.('found_articles', {
    count: searchResults.length,
    message: `Found ${searchResults.length} relevant sources`
  })

  // Step 2: Prepare articles for LLM
  const articlesText = searchResults
    .map((article, i) => `
[Article ${i + 1}]
Title: ${article.title}
Source: ${article.source || 'Unknown'}
Published: ${article.publishedDate || 'Unknown'}
Snippet: ${article.snippet}
URL: ${article.url}
`)
    .join('\n')

  onProgress?.('analyzing', { message: 'Analyzing context and forming prediction...' })

  // Step 3: Generate prediction with LLM
  const currentYear = new Date().getFullYear()
  const endOfYear = `${currentYear}-12-31T23:59:59Z`

  const prompt = getExpressPredictionPrompt({
    userInput,
    articlesText,
    endOfYear,
    currentYear,
    currentDate: new Date().toISOString().split('T')[0],
  })

  let prediction: ParsedPrediction
  try {
    const result = await llmService.generateContent({
      prompt,
      schema: expressPredictionSchema,
      temperature: 0.2, // Slightly creative but structured
    })
    prediction = JSON.parse(result.text)
  } catch (error) {
    console.error('Failed to generate express prediction:', error)
    throw error
  }

  onProgress?.('prediction_formed', {
    message: 'Prediction formed',
    preview: {
      claim: prediction.claimText,
      resolveBy: prediction.resolveByDatetime
    }
  })

  // Step 4: Select best article as NewsAnchor
  const bestArticle = searchResults[0] // Most relevant (first result)

  // Step 5: Prepare additional links
  const additionalLinks = searchResults.slice(1, 4).map(article => ({
    url: article.url,
    title: article.title
  }))

  onProgress?.('finalizing', { message: 'Finalizing prediction...' })

  return {
    ...prediction,
    domain: prediction.domain ?? 'General',
    newsAnchor: {
      url: bestArticle.url,
      urlHash: crypto.createHash('sha256').update(bestArticle.url).digest('hex'),
      title: bestArticle.title,
      snippet: bestArticle.snippet,
      source: bestArticle.source,
      publishedAt: bestArticle.publishedDate ? new Date(bestArticle.publishedDate) : undefined
    },
    additionalLinks
  }
}
