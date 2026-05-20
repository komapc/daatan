import { LLMProvider, LLMRequest, LLMResponse } from './types'
import { createLogger } from '@/lib/logger'
import { notifyLlmError } from '@/lib/services/telegram'

const log = createLogger('llm-service')

export class ResilientLLMService {
  private providers: LLMProvider[]

  constructor(providers: LLMProvider[]) {
    this.providers = providers
  }

  async generateContent(request: LLMRequest): Promise<LLMResponse> {
    let lastError: Error | null = null

    for (const provider of this.providers) {
      const t0 = Date.now()
      try {
        log.info({ provider: provider.name }, 'llm: start')
        const response = await provider.generateContent(request)
        log.info(
          { provider: provider.name, durationMs: Date.now() - t0, tokens: response.usage?.totalTokens },
          'llm: success',
        )
        return response
      } catch (error) {
        log.error({ err: error, provider: provider.name, durationMs: Date.now() - t0 }, 'Provider failed')
        lastError = error as Error

        // Notify Telegram about LLM provider error
        notifyLlmError(provider.name, lastError.message)

        continue // Try next provider
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`)
  }
}
