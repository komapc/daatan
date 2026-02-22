import { GeminiProvider } from './providers/gemini'
import { OllamaProvider } from './providers/ollama'
import { OpenRouterProvider } from './providers/openrouter'
import { ResilientLLMService } from './service'
import type { LLMProvider } from './types'
import { createLogger } from '@/lib/logger'

const log = createLogger('llm')

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
  log.warn(
    'GEMINI_API_KEY is not set; Gemini provider will be disabled. ' +
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

/**
 * Creates an LLM service backed by OpenRouter for a specific model.
 * Used by the bot runner where each bot may have a different model preference.
 */
export function createBotLLMService(modelName: string): ResilientLLMService {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || ''
  const geminiApiKey = process.env.GEMINI_API_KEY || ''

  const providers: LLMProvider[] = []

  // If model looks like a Google model and we have a direct key, try direct provider first
  if (modelName.toLowerCase().includes('gemini') && geminiApiKey) {
    // Extract base model name from OpenRouter slug
    // e.g. "google/gemini-2.0-flash-exp:free" -> "gemini-2.0-flash-exp"
    let directModelName = modelName.split(':').shift()?.split('/').pop() || 'gemini-1.5-flash'

    // Ensure we handle known renames or experimental suffixes if needed
    if (directModelName === 'gemini-2.0-flash-exp') {
      // Sometimes just 'gemini-2.0-flash' is more stable
      // But let's try the requested one first as we have resilience
    }

    log.info({ modelName, directModelName }, 'Trying direct Gemini provider for bot')
    providers.push(new GeminiProvider({ apiKey: geminiApiKey, modelName: directModelName }))
  }

  if (openrouterApiKey) {
    log.info({ modelName }, 'Adding OpenRouter provider for bot')
    providers.push(new OpenRouterProvider({ apiKey: openrouterApiKey, modelName }))
  }

  // Final fallback: direct stable Gemini if we have a key and requested model was Gemini
  if (modelName.toLowerCase().includes('gemini') && geminiApiKey) {
    log.info('Adding stable gemini-1.5-flash as final fallback')
    providers.push(new GeminiProvider({ apiKey: geminiApiKey, modelName: 'gemini-1.5-flash' }))
  }

  if (providers.length === 0) {
    log.warn({ modelName, hasOpenRouter: !!openrouterApiKey, hasGemini: !!geminiApiKey }, 'No LLM providers available for bot')
  }

  return new ResilientLLMService(providers)
}
