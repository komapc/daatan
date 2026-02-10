import { LLMProvider, LLMRequest, LLMResponse } from './types'

export class ResilientLLMService {
  private providers: LLMProvider[]

  constructor(providers: LLMProvider[]) {
    this.providers = providers
  }

  async generateContent(request: LLMRequest): Promise<LLMResponse> {
    let lastError: Error | null = null

    for (const provider of this.providers) {
      try {
        console.log(`Attempting generation with provider: ${provider.name}`)
        const response = await provider.generateContent(request)
        return response
      } catch (error) {
        console.error(`Provider ${provider.name} failed:`, error)
        lastError = error as Error
        continue // Try next provider
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`)
  }
}
