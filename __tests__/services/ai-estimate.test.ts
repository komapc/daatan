import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { commitment: { update: vi.fn() } },
}))
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/lib/llm', () => ({
  llmService: { generateContent: vi.fn() },
}))

describe('triggerAiProbabilityEstimate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates commitment with parsed probability on success', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { llmService } = await import('@/lib/llm')
    const { triggerAiProbabilityEstimate } = await import('@/lib/services/ai-estimate')

    vi.mocked(llmService.generateContent).mockResolvedValue({ text: '70' } as any)

    await triggerAiProbabilityEstimate('c1', 'Will it rain?')

    expect(prisma.commitment.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { aiProbabilityAtCommit: 0.7 },
    })
  })

  it('retries and still updates on transient failure then success', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { llmService } = await import('@/lib/llm')
    const { triggerAiProbabilityEstimate } = await import('@/lib/services/ai-estimate')

    vi.mocked(llmService.generateContent)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue({ text: '40' } as any)

    await triggerAiProbabilityEstimate('c2', 'Will it snow?')

    expect(prisma.commitment.update).toHaveBeenCalledWith({
      where: { id: 'c2' },
      data: { aiProbabilityAtCommit: 0.4 },
    })
  })

  it('does not update commitment when LLM always fails', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { llmService } = await import('@/lib/llm')
    const { triggerAiProbabilityEstimate } = await import('@/lib/services/ai-estimate')

    vi.mocked(llmService.generateContent).mockRejectedValue(new Error('LLM down'))

    await triggerAiProbabilityEstimate('c3', 'Will markets crash?')

    expect(prisma.commitment.update).not.toHaveBeenCalled()
  })

  it('does not update commitment when LLM returns non-numeric text', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { llmService } = await import('@/lib/llm')
    const { triggerAiProbabilityEstimate } = await import('@/lib/services/ai-estimate')

    vi.mocked(llmService.generateContent).mockResolvedValue({ text: 'probably yes' } as any)

    await triggerAiProbabilityEstimate('c4', 'Will peace prevail?')

    expect(prisma.commitment.update).not.toHaveBeenCalled()
  })

  it('does not throw — fire-and-forget contract', async () => {
    const { llmService } = await import('@/lib/llm')
    const { triggerAiProbabilityEstimate } = await import('@/lib/services/ai-estimate')

    vi.mocked(llmService.generateContent).mockRejectedValue(new Error('fatal'))

    await expect(triggerAiProbabilityEstimate('c5', 'Test')).resolves.toBeUndefined()
  })
})
