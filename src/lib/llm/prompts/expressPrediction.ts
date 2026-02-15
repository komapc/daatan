/**
 * Prompt for converting a user's casual prediction idea into a formal,
 * testable prediction (Express forecast creation).
 * Used by: generateExpressPrediction in expressPrediction.ts
 */

export interface ExpressPredictionPromptParams {
  userInput: string
  articlesText: string
  endOfYear: string
  endOfYearHuman: string
  currentYear: number
  currentDate: string
}

/**
 * Builds the full prompt for the Express prediction LLM call.
 */
const STANDARD_TAGS = [
  "Politics", "Geopolitics", "Economy", "Technology", "AI", "Crypto", "Sports",
  "Entertainment", "Science", "Climate", "Health", "Business", "Conflict",
  "Elections", "US Politics", "Europe", "Middle East", "Asia", "Energy", "Space"
]

export function getExpressPredictionPrompt(params: ExpressPredictionPromptParams): string {
  const { userInput, articlesText, endOfYear, endOfYearHuman, currentYear, currentDate } = params
  return `You are a prediction assistant for DAATAN, a reputation-based prediction platform. Your job is to convert user's casual prediction ideas into formal, testable predictions.

Rules:
1. Create clear, unambiguous claims that can be objectively verified
2. Infer resolution dates from context (e.g., "this year" = end of current year)
3. If no timeframe mentioned, default to end of current year (${endOfYearHuman})
4. Summarize current situation based on provided articles (2-3 sentences, factual)
5. Focus on factual, verifiable outcomes
6. Avoid subjective or opinion-based predictions
7. Use present or future tense for claims
8. **claimText must use natural-language dates** (e.g. "by December 31, ${currentYear}", "before March 2027"). NEVER put ISO timestamps like "${endOfYear}" into the claim.
9. **Resolution Rules**: Specify exactly how to determine the outcome (e.g., "Resolved by AP or Reuters reporting X").
10. **Tags**: Assign 1-3 relevant tags. Prioritize these standard tags: ${STANDARD_TAGS.join(', ')}. You may create new tags if necessary but prefer standard ones.

User wants to predict: "${userInput}"

Current date: ${currentDate}
Current year: ${currentYear}

Based on these recent articles/context:
${articlesText}

Generate a structured prediction with:
1. Formal claim statement (clear, testable, specific — use human-readable dates, not ISO)
2. Resolution date as ISO 8601 datetime (infer from user input or default to ${endOfYear})
3. Context summary (2-3 sentences about current situation from articles)
4. Tags (array of strings, e.g. ["Geopolitics", "Iran"])
5. Resolution rules (specific criteria for resolution)
6. Domain/category (DEPRECATED - just use "General" or infer main category)

Return as JSON matching the schema.`
}
