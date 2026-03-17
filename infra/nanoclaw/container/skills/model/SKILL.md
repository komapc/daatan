---
name: model
description: Switch the AI model between flash (fast) and pro (smart). Usage: /model flash or /model pro
allowed-tools: Bash
---

# Switch AI Model

The user wants to switch the AI model. Use Bash to call the LiteLLM management API.

Available models:
- **flash** = gemini/gemini-3-flash-preview (fast, default)
- **pro** = gemini/gemini-3-pro-preview (smarter, slower)

The LiteLLM API is at http://host.docker.internal:4000 with master key sk-placeholder.

Model aliases to update: claude-sonnet-4-6, claude-sonnet-4-5, claude-3-5-sonnet-20241022, claude-3-5-sonnet-20240620

Determine the target gemini model from the argument (flash or pro), then run:

```bash
TARGET="gemini/gemini-3-flash-preview"  # or gemini-3-pro-preview for pro
for model in claude-sonnet-4-6 claude-sonnet-4-5 claude-3-5-sonnet-20241022 claude-3-5-sonnet-20240620; do
  curl -s -X POST http://host.docker.internal:4000/model/update \
    -H "Authorization: Bearer sk-placeholder" \
    -H "Content-Type: application/json" \
    -d "{\"model_id\": \"$model\", \"litellm_params\": {\"model\": \"$TARGET\", \"api_key\": \"os.environ/GEMINI_API_KEY\"}}"
done
```

Confirm success and tell the user which model is now active.
