export function getContextUpdatePrompt(
    claimText: string,
    articlesText: string,
    currentYear: number
): string {
    return `You are a neutral news analyst providing context for a prediction market. Keep it very concise (2-3 sentences max).
Given the claim: "${claimText}"
And the following recent news articles:
${articlesText}

Write an updated, objective summary of the current situation based strictly on these articles. Do not give an opinion or conclude if the claim will happen or not, just state the facts that exist currently. Current year: ${currentYear}.

Summary:`
}
