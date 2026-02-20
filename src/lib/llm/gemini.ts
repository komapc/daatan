import { SchemaType, type Schema } from '@google/generative-ai'
import { getExtractPredictionPrompt } from './prompts'
import { llmService } from './index'
import { createLogger } from '@/lib/logger'

const log = createLogger('llm-gemini')


export const predictionSchema: Schema = {
  description: "Structured prediction data extracted from text or URL",
  type: SchemaType.OBJECT,
  properties: {
    claim: {
      type: SchemaType.STRING,
      description: "The core prediction or claim made by the person",
    },
    author: {
      type: SchemaType.STRING,
      description: "The name of the person who made the prediction",
    },
    sourceUrl: {
      type: SchemaType.STRING,
      description: "The source URL where the prediction was found",
    },
    resolutionDate: {
      type: SchemaType.STRING,
      description: "The date when the prediction can be verified (ISO 8601 format)",
    },
    outcomeOptions: {
      type: SchemaType.ARRAY,
      description: "The possible outcomes for the prediction (e.g., ['Yes', 'No'])",
      items: {
        type: SchemaType.STRING
      }
    }
  },
  required: ["claim", "author", "resolutionDate", "outcomeOptions"],
}

export async function extractPrediction(text: string) {
  const prompt = getExtractPredictionPrompt(text)
  
  try {
    const result = await llmService.generateContent({
      prompt,
      schema: predictionSchema,
      temperature: 0.1,
    })
    
    try {
      return JSON.parse(result.text)
    } catch {
      log.error({ text: result.text }, 'Failed to parse LLM response as JSON')
      throw new Error('LLM returned malformed JSON')
    }
  } catch (error) {
    log.error({ err: error }, 'Failed to extract prediction')
    throw error
  }
}
