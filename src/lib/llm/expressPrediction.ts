import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'
import { searchArticles } from '../utils/webSearch'
import crypto from 'crypto'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

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
    domain: {
      type: SchemaType.STRING,
      description: "Category: politics, tech, sports, economics, science, entertainment, other",
    },
  },
  required: ["claimText", "resolveByDatetime", "detailsText", "domain"],
}

export interface ExpressPredictionResult {
  claimText: string
  resolveByDatetime: string
  detailsText: string
  domain: string
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
  // Step 1: Search for relevant articles
  onProgress?.('searching', { message: 'Searching for relevant articles...' })
  
  const searchResults = await searchArticles(userInput, 5)
  
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

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: expressPredictionSchema,
    },
  })

  const prompt = `You are a prediction assistant for DAATAN, a reputation-based prediction platform. Your job is to convert user's casual prediction ideas into formal, testable predictions.

Rules:
1. Create clear, unambiguous claims that can be objectively verified
2. Infer resolution dates from context (e.g., "this year" = Dec 31 of current year)
3. If no timeframe mentioned, default to end of current year (${endOfYear})
4. Summarize current situation based on provided articles (2-3 sentences, factual)
5. Focus on factual, verifiable outcomes
6. Avoid subjective or opinion-based predictions
7. Use present or future tense for claims
8. Be specific about what constitutes success/failure

User wants to predict: "${userInput}"

Current date: ${new Date().toISOString().split('T')[0]}
Current year: ${currentYear}

Based on these recent articles:
${articlesText}

Generate a structured prediction with:
1. Formal claim statement (clear, testable, specific)
2. Resolution date (infer from user input or default to ${endOfYear})
3. Context summary (2-3 sentences about current situation from articles)
4. Domain/category (politics, tech, sports, economics, science, entertainment, other)

Return as JSON matching the schema.`

  const result = await model.generateContent(prompt)
  const response = result.response
  const prediction = JSON.parse(response.text())

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
