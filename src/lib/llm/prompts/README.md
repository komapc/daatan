# LLM Prompts (Bedrock)

All prompt templates for forecast/prediction creation are managed in **AWS Bedrock Prompt Management** (eu-central-1).

The application fetches templates at runtime using `src/lib/llm/bedrock-prompts.ts`, which uses an ARN stored in SSM Parameter Store.

| Prompt Name | Used by | Purpose |
|-------------|---------|---------|
| `express-prediction` | `generateExpressPrediction()` | Convert user's casual idea + articles into a formal, testable prediction (Express flow). |
| `extract-prediction` | `extractPrediction()` | Extract structured prediction from arbitrary text. |
| `suggest-tags` | `suggestTags()` | Suggest 1-3 relevant tags for a prediction. |
| `update-context` | `POST /api/forecasts/[id]/context` | Summarize new developments for an active prediction. |

## How to Update a Prompt

1.  Open **AWS Bedrock Console** → **Prompt Management**.
2.  Edit the prompt template (e.g., `daatan-express-prediction`).
3.  Use `{{variable}}` syntax for placeholders.
4.  Create a new **Version**.
5.  Update the SSM parameter with the new Version ARN using `scripts/promote-prompt.sh`:
    ```bash
    ./scripts/promote-prompt.sh staging express-prediction arn:aws:bedrock:...:prompt/ID:VERSION
    ```
6.  The app will pick up the new version within 5 minutes (due to cache).
