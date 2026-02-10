# LLM Prompts

Single source of truth for all prompts sent to the LLM (Gemini) in forecast/prediction creation.

| Prompt | File | Used by | Purpose |
|--------|------|---------|---------|
| Express prediction | `expressPrediction.ts` | `generateExpressPrediction()` in `../expressPrediction.ts` | Convert user's casual idea + articles into a formal, testable prediction (Express flow). |
| Extract prediction | `extractPrediction.ts` | `extractPrediction()` in `../gemini.ts` | Extract structured prediction (claim, author, resolution date, outcome options) from arbitrary text. |

To add or change a prompt: edit the corresponding file in this directory and ensure the consumer (in `../`) calls the builder function with the required parameters. Do not inline prompt strings in `expressPrediction.ts` or `gemini.ts`.
