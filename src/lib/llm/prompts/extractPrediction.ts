/**
 * Prompt for extracting a structured prediction from arbitrary text
 * (e.g. pasted article or URL content).
 * Used by: extractPrediction in gemini.ts
 */

/**
 * Builds the full prompt for the extract-prediction LLM call.
 */
export function getExtractPredictionPrompt(text: string): string {
  return `
    Extract a structured prediction from the following text. 
    If a resolution date is not explicitly mentioned, infer the most logical one based on the context.
    If the text contains multiple predictions, focus on the most prominent one.

    Required JSON structure:
    {
      "claim": "The core prediction or claim",
      "author": "Name of the person making the prediction",
      "sourceUrl": "Source URL if available",
      "resolutionDate": "ISO 8601 date (YYYY-MM-DD)",
      "outcomeOptions": ["Yes", "No"] // or other mutually exclusive options
    }
    
    Text:
    ${text}
  `.trim()
}
