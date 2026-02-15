import { describe, it, expect } from 'vitest'
import { getExpressPredictionPrompt } from '@/lib/llm/prompts/expressPrediction'

describe('getExpressPredictionPrompt', () => {
  const baseParams = {
    userInput: 'Who will win the 2028 US presidential election?',
    articlesText: '[Article 1]\nTitle: Election News\nSource: Reuters\nPublished: 2026-02-01\nSnippet: Latest polling data.\nURL: https://example.com',
    endOfYear: '2028-12-31T23:59:59Z',
    endOfYearHuman: 'December 31, 2028',
    currentYear: 2026,
    currentDate: '2026-02-15',
  }

  it('includes multiple choice detection instructions', () => {
    const prompt = getExpressPredictionPrompt(baseParams)
    expect(prompt).toContain('MULTIPLE_CHOICE')
    expect(prompt).toContain('BINARY')
  })

  it('instructs to include "Other" option for multiple choice', () => {
    const prompt = getExpressPredictionPrompt(baseParams)
    expect(prompt).toContain('Other')
  })

  it('includes the user input in the prompt', () => {
    const prompt = getExpressPredictionPrompt(baseParams)
    expect(prompt).toContain(baseParams.userInput)
  })

  it('includes current date and year', () => {
    const prompt = getExpressPredictionPrompt(baseParams)
    expect(prompt).toContain('2026-02-15')
    expect(prompt).toContain('2026')
  })

  it('includes articles text', () => {
    const prompt = getExpressPredictionPrompt(baseParams)
    expect(prompt).toContain('Election News')
    expect(prompt).toContain('Reuters')
  })

  it('mentions outcome type and options in the output instructions', () => {
    const prompt = getExpressPredictionPrompt(baseParams)
    expect(prompt).toContain('Outcome type')
    expect(prompt).toContain('Options')
  })

  it('includes standard tags list', () => {
    const prompt = getExpressPredictionPrompt(baseParams)
    expect(prompt).toContain('Politics')
    expect(prompt).toContain('Geopolitics')
    expect(prompt).toContain('Economy')
    expect(prompt).toContain('AI')
  })
})
