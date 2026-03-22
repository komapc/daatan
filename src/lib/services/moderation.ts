import { SchemaType, type Schema } from '@google/generative-ai'
import { getPromptTemplate, fillPrompt } from '../llm/bedrock-prompts'
import { llmService } from '../llm'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const log = createLogger('moderation-service')

export const moderationSchema: Schema = {
  description: "Result of content moderation check",
  type: SchemaType.OBJECT,
  properties: {
    isOffensive: {
      type: SchemaType.BOOLEAN,
      description: "Whether the content violates safety policies",
    },
    reason: {
      type: SchemaType.STRING,
      description: "Brief explanation of the violation if isOffensive is true",
    },
  },
  required: ["isOffensive", "reason"],
}

export interface ModerationResult {
  isOffensive: boolean
  reason: string
}

const moderationResultSchema = z.object({
  isOffensive: z.boolean(),
  reason: z.string(),
})

/**
 * Check if text content is offensive or violates policies.
 */
export async function checkContent(
  text: string,
  contentType: 'forecast' | 'comment'
): Promise<ModerationResult> {
  // Fast path for empty content
  if (!text.trim()) {
    return { isOffensive: false, reason: '' }
  }

  try {
    const template = await getPromptTemplate('content-moderation')
    const prompt = fillPrompt(template, {
      text: text.substring(0, 5000), // Cap length for safety
      contentType,
    })

    const result = await llmService.generateContent({
      prompt,
      schema: moderationSchema,
      temperature: 0, // High consistency for moderation
    })

    const parsed = moderationResultSchema.parse(JSON.parse(result.text))
    
    if (parsed.isOffensive) {
      log.warn({ contentType, text: text.substring(0, 100), reason: parsed.reason }, 'Content blocked by AI moderation')
    }

    return parsed
  } catch (error) {
    log.error({ err: error, contentType }, 'Moderation check failed, allowing content as fallback')
    // Fail safe: if AI moderation fails, allow content but log the error
    return { isOffensive: false, reason: '' }
  }
}
