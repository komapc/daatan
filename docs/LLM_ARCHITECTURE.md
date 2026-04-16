# LLM Architecture & Fallback Strategy

## Overview

The application uses a **Resilient LLM Service** that abstracts the underlying AI providers. This ensures high availability by automatically falling back to secondary providers if the primary one fails.

## Provider Chain

1.  **Primary**: **Google Gemini** (`gemini-2.5-flash`)
    *   Fast, cost-effective, high quality.
    *   Used for all standard requests via `llmService`.
    *   Requires `GEMINI_API_KEY`.

2.  **Secondary (Fallback)**: **Ollama** (hosting `qwen2.5:7b`)
    *   Self-hosted, private, no per-token cost.
    *   Used automatically if Gemini returns an error (timeout, rate limit, 5xx).
    *   Requires `OLLAMA_BASE_URL` (default: `http://localhost:11434`).

3.  **Bots**: **OpenRouter**
    *   Used by autonomous bot users via `createBotLLMService(modelPreference)`.
    *   Allows per-bot model selection (e.g., `mistralai/mixtral-8x7b`).
    *   Requires `OPENROUTER_API_KEY`.

## Code Structure

*   **`src/lib/llm/types.ts`**: Interfaces for `LLMProvider`, `LLMRequest`, `LLMResponse`.
*   **`src/lib/llm/providers/`**: Implementations for specific services.
    *   `gemini.ts`: Wrapper for Google Generative AI SDK.
    *   `ollama.ts`: HTTP client for Ollama API.
    *   `openrouter.ts`: HTTP client for OpenRouter API (used by bots).
*   **`src/lib/llm/service.ts`**: `ResilientLLMService` class that handles the retry/fallback logic.
*   **`src/lib/llm/bedrock-prompts.ts`**: AWS Bedrock Prompt Management client (5-minute TTL cache).
*   **`src/lib/llm/index.ts`**: Instantiates and exports `llmService` and `createBotLLMService`.

## Bedrock Prompt Management

LLM prompts are managed via **AWS Bedrock Prompt Management** rather than local files. The flow is:

```
SSM Parameter Store             Bedrock Prompt Management
/daatan/{env}/prompts/{name}  →  arn:aws:bedrock:...:prompt/{ID}:{version}
        ↓                                    ↓
  bedrock-prompts.ts  ←──── GetPromptCommand ────────────────────────
  (5-min TTL cache)
        ↓
  prompt template string
  (with {{variable}} placeholders)
```

Usage:
```typescript
import { getBedrockPrompt } from '@/lib/llm/bedrock-prompts'

const prompt = await getBedrockPrompt('express-prediction')
// Returns the prompt template string; falls back to hardcoded string if SSM=PLACEHOLDER
```

**Fallback behavior**: if the SSM value is `PLACEHOLDER` or the Bedrock fetch fails, a hardcoded fallback prompt is used so the app never breaks.

**To update a prompt**: edit the DRAFT in the Bedrock console → create a new version → update the SSM parameter to the new ARN. The cache clears within 5 minutes.

See `docs/bots.md` → [Bedrock Prompts Catalog](bots.md#bedrock-prompts-catalog) for the full list of prompt names, IDs, and SSM keys.

Requires `AWS_REGION` and an IAM role/profile with `bedrock:GetPrompt` and `ssm:GetParameter` permissions.

## Usage

### Standard requests (Gemini → Ollama fallback)

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

### Bot requests (OpenRouter)

```typescript
import { createBotLLMService } from '@/lib/llm'

const botLlm = createBotLLMService('mistralai/mixtral-8x7b')
const response = await botLlm.generateContent({ prompt: "..." })
```

## Adding a New Provider

1.  Create a class in `src/lib/llm/providers/` implementing `LLMProvider`.
2.  Add it to the initialization list in `src/lib/llm/index.ts`.

---

## Oracle API Integration (Planned)

The **TruthMachine Oracle** (`oracle.daatan.com`) is a separate FastAPI service that returns calibrated probability estimates for binary questions, weighted by each source's historical Brier score from the Factum Atlas.

**Status:** API + pipeline implemented. Pending EC2 deploy and daatan wiring.

### Integration point

```typescript
// src/lib/services/oracle.ts  (to be created)
export async function getOracleForecast(question: string): Promise<number | null> {
  const url = process.env.ORACLE_URL
  const key = process.env.ORACLE_API_KEY
  if (!url || !key) return null

  const res = await fetch(`${url}/forecast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ question }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.mean + 1) / 2  // convert stance [-1,1] → probability [0,1]
}
```

### Required env vars (not yet added)

| Variable | Description |
|---|---|
| `ORACLE_URL` | `https://oracle.daatan.com` |
| `ORACLE_API_KEY` | Shared secret (same key configured in `oracle-api.service` on retro EC2) |

See [retro/docs/ORACLE_API.md](https://github.com/komapc/retro/blob/main/docs/ORACLE_API.md) for full Oracle API documentation.
