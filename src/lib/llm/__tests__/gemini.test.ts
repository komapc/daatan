import { describe, it, expect, vi } from 'vitest'

// Mock the LLM service that `gemini.ts` depends on so tests do not require
// real API keys or network access. We use `vi.hoisted` so the mock is
// initialized before the hoisted `vi.mock` factory executes.
const generateContentMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    text: JSON.stringify({
      claim: 'Bitcoin will reach $100k',
      author: 'John Doe',
      resolutionDate: '2026-07-01',
      outcomeOptions: ['Yes', 'No'],
    }),
  }),
)

vi.mock('../index', () => ({
  llmService: {
    generateContent: generateContentMock,
  },
}))

import { extractPrediction } from '../gemini'

describe('Gemini LLM Integration (via llmService)', () => {
  it('extracts prediction from text successfully', async () => {
    const result = await extractPrediction(
      'John Doe says Bitcoin will reach $100k by July 2026',
    )

    expect(result).toBeDefined()
    expect(result.claim).toBe('Bitcoin will reach $100k')
    expect(result.author).toBe('John Doe')
    expect(result.resolutionDate).toBe('2026-07-01')
    expect(result.outcomeOptions).toContain('Yes')

    expect(generateContentMock).toHaveBeenCalledTimes(1)
  })
})
