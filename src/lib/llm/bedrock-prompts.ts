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

interface CacheEntry {
    template: string
    expiresAt: number
}

const templateCache = new Map<PromptName, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Force a crash if fetching fails because prompts are critical for the app.
 */
function failFast(message: string, error?: unknown): never {
    log.error({ err: error }, message)
    throw new Error(`${message}: ${error instanceof Error ? error.message : String(error)}`)
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
            failFast(`SSM parameter ${paramName} contains invalid ARN: ${promptArn}`)
        }

        log.debug({ promptName, promptArn }, 'Fetched ARN from SSM, now fetching from Bedrock')
        // ARN format typically includes :prompt/ID:VERSION
        const bedrockRes = await bedrock.send(new GetPromptCommand({ promptIdentifier: promptArn }))

        // The variant contains the actual template string. We assume standard text prompt variant.
        const templateText = bedrockRes.variants?.[0]?.templateConfiguration?.text?.text

        if (!templateText) {
            failFast(`Bedrock prompt ${promptArn} returned no text template in variant 0`)
        }

        // 3. Cache and return
        templateCache.set(promptName, {
            template: templateText,
            expiresAt: now + CACHE_TTL_MS
        })

        return templateText
    } catch (error) {
        log.error({ err: error, promptName, paramName, region: REGION }, 'Failed to fetch prompt template from AWS')
        failFast(`Failed to fetch Bedrock prompt '${promptName}'`, error)
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
