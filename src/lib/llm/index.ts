import { GeminiProvider } from './providers/gemini'
import { OllamaProvider } from './providers/ollama'
import { ResilientLLMService } from './service'
import type { LLMProvider } from './types'

// Configuration
const geminiApiKey = process.env.GEMINI_API_KEY || ''
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'

// Initialize providers list in priority order
const providers: LLMProvider[] = []

// Only register Gemini when an API key is available.
// In CI/test environments we often don't have a real key,
// so we gracefully skip Gemini and rely on other providers.
if (geminiApiKey) {
  providers.push(
    new GeminiProvider({
      apiKey: geminiApiKey,
      modelName: 'gemini-2.5-flash',
    }),
  )
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[LLM] GEMINI_API_KEY is not set; Gemini provider will be disabled. ' +
      'Only fallback providers (e.g. Ollama) will be used.',
  )
}

// Always register Ollama as a fallback provider (when reachable)
providers.push(
  new OllamaProvider({
    baseUrl: ollamaBaseUrl,
    modelName: 'qwen2.5:7b', // Default fallback model
  }),
)

// Create service instance with fallback strategy.
// Tries providers in the order they were registered above.
export const llmService = new ResilientLLMService(providers)
