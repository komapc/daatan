import { describe, it, expect, vi } from 'vitest'
import { extractPrediction } from '../gemini'

// Mock the GoogleGenerativeAI SDK
vi.mock('@google/generative-ai', () => {
  const generateContentMock = vi.fn().mockResolvedValue({
    response: {
      text: () => JSON.stringify({
        claim: "Bitcoin will reach $100k",
        author: "John Doe",
        resolutionDate: "2026-07-01",
        outcomeOptions: ["Yes", "No"]
      })
    }
  })

  const getGenerativeModelMock = vi.fn().mockImplementation(() => ({
    generateContent: generateContentMock
  }))

  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(function() {
      return {
        getGenerativeModel: getGenerativeModelMock
      }
    }),
    SchemaType: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      ARRAY: 'ARRAY'
    }
  }
})

describe('Gemini LLM Integration', () => {
  it('extracts prediction from text successfully', async () => {
    const result = await extractPrediction("John Doe says Bitcoin will reach $100k by July 2026")
    
    expect(result).toBeDefined()
    expect(result.claim).toBe("Bitcoin will reach $100k")
    expect(result.author).toBe("John Doe")
    expect(result.resolutionDate).toBe("2026-07-01")
    expect(result.outcomeOptions).toContain("Yes")
  })
})
