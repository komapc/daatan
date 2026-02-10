import { GeminiProvider } from './providers/gemini'
import { OllamaProvider } from './providers/ollama'
import { ResilientLLMService } from './service'

// Configuration
const geminiApiKey = process.env.GEMINI_API_KEY || ''
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'

// Initialize providers
const geminiFlash = new GeminiProvider({
  apiKey: geminiApiKey,
  modelName: 'gemini-2.5-flash',
})

const ollamaQwen = new OllamaProvider({
  baseUrl: ollamaBaseUrl,
  modelName: 'qwen2.5:7b', // Default fallback model
})

// Create service instance with fallback strategy
// Tries Gemini first, then falls back to local Ollama
export const llmService = new ResilientLLMService([geminiFlash, ollamaQwen])
