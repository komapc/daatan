import { LLMProvider, LLMRequest, LLMResponse, LLMConfig } from '../types'
import { createLogger } from '@/lib/logger'

const log = createLogger('llm-ollama')

export class OllamaProvider implements LLMProvider {
  name = 'Ollama'
  private baseUrl: string
  private modelName: string

  constructor(config: LLMConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434'
    this.modelName = config.modelName
  }

  async generateContent(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          prompt: request.prompt,
          format: request.schema ? 'json' : undefined,
          stream: false,
          options: {
            temperature: request.temperature,
          }
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        text: data.response,
        usage: {
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count,
            totalTokens: data.prompt_eval_count + data.eval_count
        }
      }
    } catch (error) {
      log.error({ err: error }, 'Ollama generation failed')
      throw error
    }
  }
}
