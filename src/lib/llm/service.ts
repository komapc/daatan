import { LLMProvider, LLMRequest, LLMResponse } from './types'
import { createLogger } from '@/lib/logger'

const log = createLogger('llm-service')

export class ResilientLLMService {
  private providers: LLMProvider[]

  constructor(providers: LLMProvider[]) {
    this.providers = providers
  }

  async generateContent(request: LLMRequest): Promise<LLMResponse> {
    let lastError: Error | null = null

    for (const provider of this.providers) {
      try {
        log.info({ provider: provider.name }, 'Attempting generation')
        const response = await provider.generateContent(request)
        return response
      } catch (error) {
        log.error({ err: error, provider: provider.name }, 'Provider failed')
        lastError = error as Error
        continue // Try next provider
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`)
  }
}
