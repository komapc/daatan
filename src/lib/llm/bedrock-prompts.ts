import { BedrockAgentClient, GetPromptCommand } from '@aws-sdk/client-bedrock-agent'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { createLogger } from '@/lib/logger'

const log = createLogger('llm-bedrock-prompts')

const REGION = process.env.AWS_REGION || 'eu-central-1'
const bedrock = new BedrockAgentClient({ region: REGION })
const ssm = new SSMClient({ region: REGION })

type PromptName =
    | 'express-prediction'
    | 'extract-prediction'
    | 'suggest-tags'
    | 'update-context'
    | 'dedupe-check'
    | 'bot-forecast-generation'
    | 'forecast-quality-validation'
    | 'bot-vote-decision'
    | 'bot-config-generation'
    | 'research-query-generation'
    | 'resolution-research'
    | 'translate'
    | 'topic-extraction'
    | 'guess-chances'
    | 'content-moderation'

interface CacheEntry {
    template: string
    expiresAt: number
}

const templateCache = new Map<PromptName, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Hardcoded fallback prompts used when the SSM parameter is PLACEHOLDER or
 * Bedrock is not configured. These are the original inline prompts that existed
 * before the Bedrock migration and are kept in sync manually.
 */
const FALLBACK_PROMPTS: Partial<Record<PromptName, string>> = {
    'resolution-research': `You are an expert fact-checker and forecast resolver.
Your task is to determine the outcome of the following forecast.

Forecast Claim: {{claimText}}
Outcome Type: {{outcomeType}}{{optionsContext}}
Resolution Rules: {{resolutionRules}}

Forecast Period: {{forecastStartStr}} to {{forecastEndStr}}
Current Date: {{currentDate}}

{{context}}

Instructions:
1. Determine what happened during the forecast period ({{forecastStartStr}} to {{forecastEndStr}}) with respect to the claim.
2. Use the news context above as your primary evidence. If it is insufficient or irrelevant, draw on your own knowledge of events during that period.
3. In your reasoning, explicitly list which sources or facts (from context or your own knowledge) you are using to reach your conclusion.
4. For BINARY predictions:
   - If the claim is clearly true (the event happened as stated), use 'correct'.
   - If the claim is clearly false (the event did not happen), use 'wrong'.
   - Only use 'unresolvable' if you genuinely have no reliable information for the period.
5. For MULTIPLE_CHOICE predictions:
   - If one option clearly occurred, use 'correct' AND provide correctOptionId.
   - If no option clearly matches, use 'unresolvable'.
6. Use 'void' only if the event was cancelled or the claim cannot be judged fairly by its own rules.
7. Do NOT default to 'unresolvable' simply because the news context is empty or irrelevant — use your knowledge.

Return your findings in JSON format.`,

    'research-query-generation': `You are helping find news articles to verify a forecast.
Forecast: "{{claimText}}"
Period: {{forecastStartStr}} to {{forecastEndStr}}

Generate 2-3 short web search queries (3-7 words each) that a journalist would use to find news confirming or denying this forecast. Use past/present tense, focus on key entities and the underlying measurable event (e.g. exchange rate, election result, price). Do NOT reuse the forecast text verbatim.`,

    'dedupe-check': `You are a fact-checking assistant reviewing whether a news topic already has an active forecast.

Incoming topic: "{{topicTitle}}"

Existing active forecasts:
- {{existingTitles}}

Is this topic already substantially covered by one of the forecasts above? Reply with only "yes" or "no".`,

    'bot-forecast-generation': `{{personaPrompt}}

{{forecastPrompt}}

News topic: "{{topicTitle}}"
Source URLs: {{sourceUrls}}
Today's date: {{todayDate}}

Create a concise, verifiable forecast as JSON with these exact fields:
{
  "claimText": "A testable prediction statement starting with 🤖 (max 200 chars)",
  "detailsText": "2–4 sentences of background context and resolution criteria",
  "outcomeType": "BINARY",
  "resolveByDatetime": "ISO 8601 date, e.g. 2026-09-15T00:00:00Z (30–180 days from today)",
  "resolutionRules": "1–2 sentences describing exactly how to decide the outcome",
  "tags": ["tag1", "tag2"]
}

Requirements:
- claimText MUST begin with "🤖 "
- Be specific enough that a third party can verify the outcome objectively
- Use English throughout
- resolveByDatetime must be strictly in the future{{tagConstraint}}`,

    'forecast-quality-validation': `You are a forecast quality validator. Review this forecast for issues.

Claim: "{{claimText}}"
Details: "{{detailsText}}"
Resolve By: "{{resolveByDatetime}}"
Resolution Rules: "{{resolutionRules}}"
Original Topic: "{{topicTitle}}"

Check:
1. Is the claim specific and testable (not vague or tautological)?
2. Does the claim relate to the original topic?
3. Is resolveByDatetime a valid future date with a reasonable timeframe (30-365 days)?
4. Do the resolution rules clearly explain how to decide the outcome?

Respond ONLY with JSON: { "pass": true|false, "reason": "one sentence if failed" }`,

    'bot-vote-decision': `{{personaPrompt}}

{{votePrompt}}

Forecast: "{{claimText}}"
Details: "{{detailsText}}"
{{biasHint}}
Decide whether to commit CU to this forecast. If committing, also decide your position.

Respond with JSON: { "shouldVote": true|false, "binaryChoice": true|false, "reason": "one sentence" }
- shouldVote: true if you want to participate, false to skip
- binaryChoice: true = "this will happen", false = "this won't happen"`,

    'bot-config-generation': `You are defining a new autonomous agent for a prediction market platform.
The bot's name is "{{name}}".

Based on this name, infer what kind of topics it cares about, its personality, and what news sources it should read.
Generate a JSON object with:
- personaPrompt: "You are [Name], a [description]. You track [topics]."
- forecastPrompt: "Using the news topic, write a specific, verifiable forecast about [topics]. Avoid vague claims. Resolution window: 14-90 days."
- votePrompt: "As a [role], commit to forecasts about [topics]. Vote yes when [conditions]."
- newsSources: An array of 2-4 real world RSS feed URLs that fit this persona (e.g., https://feeds.bbci.co.uk/news/world/rss.xml, https://www.theverge.com/rss/index.xml, etc).

Make the prompts highly specific, opinionated, and sharp. Do not be generic.`,

    'suggest-tags': `You are a categorization assistant for DAATAN, a prediction platform.
Your job is to suggest 1-3 highly relevant tags for a prediction based on its claim and optional details.

### Standard Tags
Use these standard tags whenever possible:
{{STANDARD_TAGS}}

### Prediction
Claim: "{{claim}}"
{{details}}

### Instructions
1. Analyze the prediction's subject matter.
2. Select 1-3 tags that best categorize it.
3. Prioritize standard tags, but you can create a new tag if none of the standard ones fit well.
4. Return ONLY a JSON object with a "tags" array of strings.

Example:
{
  "tags": ["Crypto", "Economy"]
}`,

    'extract-prediction': `Extract a structured prediction from the following text.
If a resolution date is not explicitly mentioned, infer the most logical one based on the context.
If the text contains multiple predictions, focus on the most prominent one.

Required JSON structure:
{
  "claim": "The core prediction or claim",
  "author": "Name of the person making the prediction",
  "sourceUrl": "Source URL if available",
  "resolutionDate": "ISO 8601 date (YYYY-MM-DD)",
  "outcomeOptions": ["Yes", "No"]
}

Text:
{{text}}`,

    'update-context': `You are a neutral news analyst providing context for a prediction market. Keep it very concise (2-3 sentences max).
Given the claim: "{{claimText}}"
{{changeInstruction}}
And the following recent news articles:
{{articlesText}}

Write an updated, objective summary of the current situation based strictly on these articles. Do not give an opinion or conclude if the claim will happen or not, just state the facts that exist currently. Current year: {{currentYear}}.

Summary:`,

    'topic-extraction': `Extract the main topic of this article in 5-10 words suitable as a web search query. Return ONLY the search query, nothing else.

Article content:
{{articleContent}}`,

    'translate': `Translate the following text to {{language}}. Return only the translated text, no explanation, no quotes:

{{text}}`,

    'guess-chances': `You are an expert probability analyst for a prediction market.
Your task is to analyze the current situation and suggest the probability (0-100%) that the following forecast will happen.

Forecast: "{{claimText}}"
Context: {{detailsText}}

Related News Articles:
{{articlesText}}

Instructions:
1. Analyze the evidence from the news articles.
2. Consider the historical context provided.
3. Provide your best estimate of the probability (0 to 100).
4. Be objective and neutral.

Respond ONLY with a JSON object: { "probability": number, "reasoning": "one or two sentences explaining the number" }`,

    'content-moderation': `You are a content moderator for a civil prediction market platform.
Your job is to analyze incoming content (forecasts or comments) and determine if it violates safety policies.

### Prohibited Content:
1. Hate speech, discrimination, or promotion of violence against protected groups.
2. Encouragement of self-harm or illegal acts.
3. Sexually explicit or gratuitously gory content.
4. Harassment or doxxing of individuals.
5. Spam or scam attempts.

### Guidelines for Forecasts:
Forecasts about political figures, world events, or sensitive topics are ALLOWED as long as they are phrased neutrally and are not promoting harm (e.g. "Who will win the election?" is fine; "When will [person] be assassinated?" is NOT). Questions about wars, military conflicts, or attacks between nations are ALLOWED (e.g. "Will Moldova attack Romania?" or "Will Russia invade Ukraine again?" are fine — they are neutral geopolitical forecasts, not incitement).

### Input:
Type: {{contentType}}
Content: "{{text}}"

Respond ONLY with a JSON object: { "isOffensive": true|false, "reason": "A clear, helpful one-sentence explanation of why the content is not allowed (e.g., 'This content promotes violence and is not permitted on DAATAN' or 'This forecast contains hate speech'). If isOffensive is false, return an empty string." }`,
}

function getFallbackPrompt(promptName: PromptName, paramName: string, reason: string): string {
    const fallback = FALLBACK_PROMPTS[promptName]
    if (fallback) {
        log.warn({ promptName, paramName, reason }, 'Using hardcoded fallback prompt (Bedrock not configured)')
        return fallback
    }
    throw new Error(`Prompt '${promptName}' has no Bedrock ARN and no hardcoded fallback. Reason: ${reason}`)
}

/**
 * Fetch a prompt template from Bedrock using an ARN stored in SSM.
 * Uses a 5-minute in-memory cache.
 */
export async function getPromptTemplate(promptName: PromptName): Promise<string> {
    const now = Date.now()
    const cached = templateCache.get(promptName)

    if (cached && cached.expiresAt > now) {
        return cached.template
    }

    const rawEnv = process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || 'staging'
    const env = rawEnv === 'production' ? 'prod' : rawEnv
    const paramName = `/daatan/${env}/prompts/${promptName}`

    log.debug({ promptName, env, paramName, region: REGION }, 'Fetching prompt template')

    try {
        // 1. Get ARN from SSM
        const ssmRes = await ssm.send(new GetParameterCommand({ Name: paramName }))
        const promptArn = ssmRes.Parameter?.Value

        if (!promptArn || promptArn === 'PLACEHOLDER') {
            return getFallbackPrompt(promptName, paramName, 'SSM parameter is PLACEHOLDER')
        }

        log.debug({ promptName, promptArn }, 'Fetched ARN from SSM, now fetching from Bedrock')
        // ARN format typically includes :prompt/ID:VERSION
        const bedrockRes = await bedrock.send(new GetPromptCommand({ promptIdentifier: promptArn }))

        // The variant contains the actual template string. We assume standard text prompt variant.
        const templateText = bedrockRes.variants?.[0]?.templateConfiguration?.text?.text

        if (!templateText) {
            return getFallbackPrompt(promptName, paramName, `Bedrock returned no text template for ARN ${promptArn}`)
        }

        // Cache and return
        templateCache.set(promptName, {
            template: templateText,
            expiresAt: now + CACHE_TTL_MS
        })

        return templateText
    } catch (error) {
        log.error({ err: error, promptName, paramName, region: REGION }, 'Failed to fetch prompt template from AWS')
        return getFallbackPrompt(promptName, paramName, String(error))
    }
}

/**
 * Helper to replace {{var}} placeholders in a template with actual values.
 */
export function fillPrompt(template: string, variables: Record<string, string | number>): string {
    return Object.entries(variables).reduce((text, [key, value]) => {
        // Replace all instances of {{key}} with the stringified value
        return text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value))
    }, template)
}
