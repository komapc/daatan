import { SchemaType, type Schema } from '@google/generative-ai'
import { getExpressPredictionPrompt } from './prompts'
import { llmService } from './index'
import { searchArticles, fetchArticleContent } from '../utils/webSearch'
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

export async function generateExpressPrediction(
  userInput: string,
  onProgress?: (stage: string, data?: Record<string, unknown>) => void
): Promise<ExpressPredictionResult> {
  let searchResults: any[] = []
  let articlesText = ''

  // Step 1: Check if input is a URL
  const urlRegex = /^(https?:\/\/[^\s]+)$/i
  const isUrl = urlRegex.test(userInput.trim())

  if (isUrl) {
    onProgress?.('searching', { message: 'Fetching article content...' })
    const url = userInput.trim()
    const content = await fetchArticleContent(url) // Implement fetchArticleContent in webSearch!

    if (!content) {
      throw new Error('FAILED_TO_FETCH_URL')
    }

    searchResults = [{
      title: 'User Provided URL', // We'll try to extract title later or let LLM infer
      url: url,
      snippet: content.substring(0, 500),
      source: new URL(url).hostname,
      publishedDate: new Date().toISOString()
    }]

    articlesText = `
[Provided Article]
URL: ${url}
Content: ${content.substring(0, 8000)}
`
    onProgress?.('found_articles', {
      count: 1,
      message: 'Article content loaded'
    })
  } else {
    // Step 1: Search for relevant articles
    onProgress?.('searching', { message: 'Searching for relevant articles...' })

    searchResults = await searchArticles(userInput, 5)

    if (searchResults.length === 0) {
      throw new Error('NO_ARTICLES_FOUND')
    }

    onProgress?.('found_articles', {
      count: searchResults.length,
      message: `Found ${searchResults.length} relevant sources`
    })

    // Step 2: Prepare articles for LLM
    articlesText = searchResults
      .map((article, i) => `
[Article ${i + 1}]
Title: ${article.title}
Source: ${article.source || 'Unknown'}
Published: ${article.publishedDate || 'Unknown'}
Snippet: ${article.snippet}
URL: ${article.url}
`)
      .join('\n')
  }

  onProgress?.('analyzing', { message: 'Analyzing context and forming prediction...' })

  // Step 3: Generate prediction with LLM
  const currentYear = new Date().getFullYear()
  const endOfYear = `${currentYear}-12-31T23:59:59Z`

  const prompt = getExpressPredictionPrompt({
    userInput: isUrl ? "Create a prediction based on this article" : userInput, // Adjust prompt for URL mode
    articlesText,
    endOfYear,
    currentYear,
    currentDate: new Date().toISOString().split('T')[0],
  })

  let prediction: any
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

  // If we fetched content directly, we might not have the title perfectly.
  // The LLM context summary might be useful? Or just use what we have.
  // Ideally fetchArticleContent returns { title, content } but I implemented it as string only.
  // We'll stick with "User Provided URL" or hostname if logic above sets it.

  return {
    ...prediction,
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
