/**
 * TEST-6: softDeleteComment service tests.
 * Verifies that soft delete marks the row, hides it from listComments queries,
 * and does not trigger any notification side-effects.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    comment: {
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    commentReaction: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    commentTranslation: {
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/services/notification', () => ({ createNotification: vi.fn() }))

describe('softDeleteComment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls prisma.comment.update with deletedAt set to a Date', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { softDeleteComment } = await import('@/lib/services/comment')

    vi.mocked(prisma.comment.update).mockResolvedValue({ id: 'c1', deletedAt: new Date() } as any)

    await softDeleteComment('c1')

    expect(prisma.comment.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { deletedAt: expect.any(Date) },
    })
  })

  it('does NOT trigger any notification after soft delete', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { softDeleteComment } = await import('@/lib/services/comment')
    const { createNotification } = await import('@/lib/services/notification')

    vi.mocked(prisma.comment.update).mockResolvedValue({ id: 'c1', deletedAt: new Date() } as any)

    await softDeleteComment('c1')

    expect(createNotification).not.toHaveBeenCalled()
  })
})

describe('listComments — excludes soft-deleted rows', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes deletedAt: null to the where clause', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { listComments } = await import('@/lib/services/comment')

    vi.mocked(prisma.comment.findMany).mockResolvedValue([])
    vi.mocked(prisma.comment.count).mockResolvedValue(0)

    await listComments({ predictionId: 'pred-1', page: 1, limit: 10 })

    const findManyCall = vi.mocked(prisma.comment.findMany).mock.calls[0][0] as any
    expect(findManyCall.where).toMatchObject({ deletedAt: null })

    const countCall = vi.mocked(prisma.comment.count).mock.calls[0][0] as any
    expect(countCall.where).toMatchObject({ deletedAt: null })
  })

  it('returns only non-deleted comments in the result set', async () => {
    const { prisma } = await import('@/lib/prisma')
    const { listComments } = await import('@/lib/services/comment')

    const activeComment = {
      id: 'c-active',
      text: 'Still here',
      deletedAt: null,
      author: { id: 'u1', name: 'Alice', username: 'alice', image: null, rs: 100, role: 'USER' },
      reactions: [],
      _count: { replies: 0 },
    }
    vi.mocked(prisma.comment.findMany).mockResolvedValue([activeComment] as any)
    vi.mocked(prisma.comment.count).mockResolvedValue(1)

    const { comments, total } = await listComments({ predictionId: 'pred-1', page: 1, limit: 10 })

    expect(comments).toHaveLength(1)
    expect(comments[0].id).toBe('c-active')
    expect(total).toBe(1)
  })
})
