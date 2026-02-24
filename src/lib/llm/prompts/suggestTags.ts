import { STANDARD_TAGS } from '@/lib/constants'

export function getSuggestTagsPrompt(claim: string, details?: string): string {
    return `You are a categorization assistant for DAATAN, a prediction platform.
Your job is to suggest 1-3 highly relevant tags for a prediction based on its claim and optional details.

### Standard Tags
Use these standard tags whenever possible:
${STANDARD_TAGS.join(', ')}

### Prediction
Claim: "${claim}"
${details ? `Details: "${details}"` : ''}

### Instructions
1. Analyze the prediction's subject matter.
2. Select 1-3 tags that best categorize it.
3. Prioritize standard tags, but you can create a new tag if none of the standard ones fit well.
4. Return ONLY a JSON object with a "tags" array of strings.

Example:
{
  "tags": ["Crypto", "Economy"]
}
`
}
