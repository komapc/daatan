# LLM Architecture & Fallback Strategy

## Overview

The application uses a **Resilient LLM Service** that abstracts the underlying AI providers. This ensures high availability by automatically falling back to secondary providers if the primary one fails.

## Provider Chain

1.  **Primary**: **Google Gemini** (`gemini-2.5-flash`)
    *   Fast, cost-effective, high quality.
    *   Used for all standard requests.
    *   Requires `GEMINI_API_KEY`.

2.  **Secondary (Fallback)**: **Ollama** (hosting `qwen2.5:7b`)
    *   Self-hosted, private, no per-token cost.
    *   Used automatically if Gemini returns an error (timeout, rate limit, 5xx).
    *   Requires `OLLAMA_BASE_URL` (default: `http://localhost:11434`).

## Code Structure

*   **`src/lib/llm/types.ts`**: Interfaces for `LLMProvider`, `LLMRequest`, `LLMResponse`.
*   **`src/lib/llm/providers/`**: Implementations for specific services.
    *   `gemini.ts`: Wrapper for Google Generative AI SDK.
    *   `ollama.ts`: HTTP client for Ollama API.
*   **`src/lib/llm/service.ts`**: `ResilientLLMService` class that handles the retry/fallback logic.
*   **`src/lib/llm/index.ts`**: Instantiates and exports the configured service.

## Usage

Instead of importing `GoogleGenerativeAI` directly, use the service:

```typescript
import { llmService } from '@/lib/llm'

const response = await llmService.generateContent({
  prompt: "Your prompt here",
  schema: optionalJsonSchema, // Gemini supports this natively; Ollama uses JSON mode
  temperature: 0.7
})

console.log(response.text)
```

## Adding a New Provider

1.  Create a class in `src/lib/llm/providers/` implementing `LLMProvider`.
2.  Add it to the initialization list in `src/lib/llm/index.ts`.
