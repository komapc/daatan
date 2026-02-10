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
    
    Text:
    ${text}
  `.trim()
}
