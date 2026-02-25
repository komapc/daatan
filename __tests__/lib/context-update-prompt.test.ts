import { describe, it, expect } from 'vitest'
import { getContextUpdatePrompt } from '@/lib/llm/prompts/updateContext'

describe('getContextUpdatePrompt', () => {
  const claimText = 'Bitcoin will reach $100k by end of 2026'
  const articlesText = '[Article 1]\nTitle: Bitcoin Rally\nSource: Reuters\nPublished: 2026-02-20\nSnippet: Bitcoin surges past $90k.\n'
  const currentYear = 2026

  it('includes claim text and articles', () => {
    const prompt = getContextUpdatePrompt(claimText, articlesText, currentYear)
    expect(prompt).toContain(claimText)
    expect(prompt).toContain('Bitcoin Rally')
    expect(prompt).toContain('2026')
  })

  it('does not include change instruction when no previous context', () => {
    const prompt = getContextUpdatePrompt(claimText, articlesText, currentYear)
    expect(prompt).not.toContain('CHANGED')
    expect(prompt).not.toContain('Previous context summary')
  })

  it('does not include change instruction when previous context is null', () => {
    const prompt = getContextUpdatePrompt(claimText, articlesText, currentYear, null)
    expect(prompt).not.toContain('CHANGED')
  })

  it('includes change instruction when previous context is provided', () => {
    const previousContext = 'Bitcoin was trading at $85k with bullish momentum.'
    const prompt = getContextUpdatePrompt(claimText, articlesText, currentYear, previousContext)
    expect(prompt).toContain('CHANGED')
    expect(prompt).toContain('Previous context summary')
    expect(prompt).toContain(previousContext)
    expect(prompt).toContain('Highlight new developments')
  })

  it('always ends with Summary: marker', () => {
    const prompt = getContextUpdatePrompt(claimText, articlesText, currentYear)
    expect(prompt.trimEnd()).toMatch(/Summary:$/)
  })

  it('instructs to be concise and neutral', () => {
    const prompt = getContextUpdatePrompt(claimText, articlesText, currentYear)
    expect(prompt).toContain('2-3 sentences')
    expect(prompt).toContain('neutral')
    expect(prompt).toContain('Do not give an opinion')
  })
})
