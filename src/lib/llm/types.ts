import { Schema } from '@google/generative-ai'

export interface LLMRequest {
  prompt: string
  schema?: Schema
  temperature?: number
}

export interface LLMResponse {
  text: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface LLMProvider {
  name: string
  generateContent(request: LLMRequest): Promise<LLMResponse>
}

export interface LLMConfig {
  apiKey?: string
  baseUrl?: string
  modelName: string
}
