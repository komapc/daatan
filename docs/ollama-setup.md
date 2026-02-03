# Ollama Setup for OpenClaw Fallback

Ollama provides local LLM fallback when Gemini API quota is exhausted.

## Installation

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull recommended models
ollama pull llama3.1
ollama pull codellama
```

## Verification

```bash
# Check Ollama is running
ollama list

# Test a model
ollama run llama3.1 "Hello, world"
```

## Service Management

```bash
# Start Ollama service (if not auto-started)
ollama serve

# Check status
systemctl status ollama
```

## OpenClaw Integration

The `openclaw.json` is already configured to use Ollama as fallback:

```json
{
  "models": {
    "providers": {
      "ollama": { "baseUrl": "http://localhost:11434" }
    },
    "fallback": ["ollama/llama3.1", "ollama/codellama"]
  }
}
```

When Gemini quota is exhausted, OpenClaw will automatically switch to local models.
