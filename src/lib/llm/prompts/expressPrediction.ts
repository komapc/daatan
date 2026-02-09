/**
 * Prompt for converting a user's casual prediction idea into a formal,
 * testable prediction (Express forecast creation).
 * Used by: generateExpressPrediction in expressPrediction.ts
 */

export interface ExpressPredictionPromptParams {
  userInput: string
  articlesText: string
  endOfYear: string
  currentYear: number
  currentDate: string
}

/**
 * Builds the full prompt for the Express prediction LLM call.
 */
export function getExpressPredictionPrompt(params: ExpressPredictionPromptParams): string {
  const { userInput, articlesText, endOfYear, currentYear, currentDate } = params
  return `You are a prediction assistant for DAATAN, a reputation-based prediction platform. Your job is to convert user's casual prediction ideas into formal, testable predictions.

Rules:
1. Create clear, unambiguous claims that can be objectively verified
2. Infer resolution dates from context (e.g., "this year" = Dec 31 of current year)
3. If no timeframe mentioned, default to end of current year (${endOfYear})
4. Summarize current situation based on provided articles (2-3 sentences, factual)
5. Focus on factual, verifiable outcomes
6. Avoid subjective or opinion-based predictions
7. Use present or future tense for claims
8. Be specific about what constitutes success/failure

User wants to predict: "${userInput}"

Current date: ${currentDate}
Current year: ${currentYear}

Based on these recent articles:
${articlesText}

Generate a structured prediction with:
1. Formal claim statement (clear, testable, specific)
2. Resolution date (infer from user input or default to ${endOfYear})
3. Context summary (2-3 sentences about current situation from articles)
4. Domain/category (politics, tech, sports, economics, science, entertainment, other)

Return as JSON matching the schema.`
}
