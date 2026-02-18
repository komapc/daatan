import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getComments, POST as createComment } from '@/app/api/comments/route'
import { PATCH as updateComment, DELETE as deleteComment } from '@/app/api/comments/[id]/route'
import { POST as addReaction, DELETE as removeReaction } from '@/app/api/comments/[id]/react/route'

// Mock next-auth (both import paths used by withAuth and direct imports)
const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}))

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('@/lib/services/telegram', () => ({
  notifyNewComment: vi.fn(),
}))

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    comment: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    prediction: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    commentReaction: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

describe('Comments API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/comments', () => {
    it('returns comments for a prediction', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.comment.findMany).mockResolvedValue([
        {
          id: 'comment1',
          text: 'Test comment',
          authorId: 'user1',
          predictionId: 'pred1',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          author: {
            id: 'user1',
            name: 'Test User',
            username: 'testuser',
            image: null,
            rs: 100,
          },
          reactions: [],
          _count: { replies: 0 },
        },
      ] as any)

      vi.mocked(prisma.comment.count).mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/comments?predictionId=pred1')
      const response = await getComments(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.comments).toHaveLength(1)
      expect(data.comments[0].text).toBe('Test comment')
      expect(data.pagination.total).toBe(1)
    })

    it('filters out deleted comments', async () => {
      const { prisma } = await import('@/lib/prisma')

      const request = new NextRequest('http://localhost/api/comments?predictionId=pred1')
      await getComments(request)

      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      )
    })
  })

  describe('POST /api/comments', () => {
    it('creates a comment when authenticated', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any)

      vi.mocked(prisma.prediction.findUnique).mockResolvedValue({
        id: 'pred1',
      } as any)

      vi.mocked(prisma.comment.create).mockResolvedValue({
        id: 'comment1',
        text: 'New comment',
        authorId: 'user1',
        predictionId: 'pred1',
        forecastId: null,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        author: {
          id: 'user1',
          name: 'Test User',
          username: 'testuser',
          image: null,
          rs: 100,
        },
        reactions: [],
        _count: { replies: 0 },
      } as any)

      const request = new NextRequest('http://localhost/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          text: 'New comment',
          predictionId: 'pred1',
        }),
      })

      const response = await createComment(request, { params: {} } as any)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.text).toBe('New comment')
    })

    it('returns 401 when not authenticated', async () => {
      const { getServerSession } = await import('next-auth')

      vi.mocked(getServerSession).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          text: 'New comment',
          predictionId: 'pred1',
        }),
      })

      const response = await createComment(request, { params: {} } as any)

      expect(response.status).toBe(401)
    })

    it('validates that predictionId is required', async () => {
      const { getServerSession } = await import('next-auth')

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any)

      const request = new NextRequest('http://localhost/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          text: 'New comment',
          // Missing predictionId
        }),
      })

      const response = await createComment(request, { params: {} } as any)

      expect(response.status).toBe(400)
    })
  })

  describe('PATCH /api/comments/[id]', () => {
    it('updates own comment', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: 'comment1',
        authorId: 'user1',
        deletedAt: null,
      } as any)

      vi.mocked(prisma.comment.update).mockResolvedValue({
        id: 'comment1',
        text: 'Updated comment',
        authorId: 'user1',
        predictionId: 'pred1',
        forecastId: null,
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        author: {
          id: 'user1',
          name: 'Test User',
          username: 'testuser',
          image: null,
          rs: 100,
        },
        reactions: [],
        _count: { replies: 0 },
      } as any)

      const request = new NextRequest('http://localhost/api/comments/comment1', {
        method: 'PATCH',
        body: JSON.stringify({
          text: 'Updated comment',
        }),
      })

      const response = await updateComment(request, { params: { id: 'comment1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.text).toBe('Updated comment')
    })

    it('returns 403 when trying to update someone elses comment', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: 'comment1',
        authorId: 'user2', // Different user
        deletedAt: null,
      } as any)

      const request = new NextRequest('http://localhost/api/comments/comment1', {
        method: 'PATCH',
        body: JSON.stringify({
          text: 'Updated comment',
        }),
      })

      const response = await updateComment(request, { params: { id: 'comment1' } })

      expect(response.status).toBe(403)
    })
  })

  describe('DELETE /api/comments/[id]', () => {
    it('soft deletes own comment', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: 'comment1',
        authorId: 'user1',
        deletedAt: null,
      } as any)

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user1',
      } as any)

      vi.mocked(prisma.comment.update).mockResolvedValue({} as any)

      const request = new NextRequest('http://localhost/api/comments/comment1', {
        method: 'DELETE',
      })

      const response = await deleteComment(request, { params: { id: 'comment1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(prisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comment1' },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        })
      )
    })

    it('allows admin to delete any comment', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'admin1', email: 'admin@example.com', role: 'ADMIN' },
      } as any)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: 'comment1',
        authorId: 'user2', // Different user
        deletedAt: null,
      } as any)

      vi.mocked(prisma.comment.update).mockResolvedValue({} as any)

      const request = new NextRequest('http://localhost/api/comments/comment1', {
        method: 'DELETE',
      })

      const response = await deleteComment(request, { params: { id: 'comment1' } })

      expect(response.status).toBe(200)
    })

    it('allows RESOLVER to delete any comment', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'resolver1', email: 'resolver@example.com', role: 'RESOLVER' },
      } as any)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: 'comment1',
        authorId: 'user2', // Different user - resolver can still delete
        deletedAt: null,
      } as any)

      vi.mocked(prisma.comment.update).mockResolvedValue({} as any)

      const request = new NextRequest('http://localhost/api/comments/comment1', {
        method: 'DELETE',
      })

      const response = await deleteComment(request, { params: { id: 'comment1' } })

      expect(response.status).toBe(200)
      expect(prisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comment1' },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        })
      )
    })
  })

  describe('POST /api/comments/[id]/react', () => {
    it('adds a reaction to a comment', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue({
        id: 'comment1',
        deletedAt: null,
      } as any)

      vi.mocked(prisma.commentReaction.upsert).mockResolvedValue({
        id: 'reaction1',
        userId: 'user1',
        commentId: 'comment1',
        type: 'LIKE',
        createdAt: new Date(),
        user: {
          id: 'user1',
          name: 'Test User',
          username: 'testuser',
        },
      } as any)

      const request = new NextRequest('http://localhost/api/comments/comment1/react', {
        method: 'POST',
        body: JSON.stringify({
          type: 'LIKE',
        }),
      })

      const response = await addReaction(request, { params: { id: 'comment1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.type).toBe('LIKE')
    })

    it('returns 401 when not authenticated', async () => {
      const { getServerSession } = await import('next-auth')

      vi.mocked(getServerSession).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/comments/comment1/react', {
        method: 'POST',
        body: JSON.stringify({
          type: 'LIKE',
        }),
      })

      const response = await addReaction(request, { params: { id: 'comment1' } })

      expect(response.status).toBe(401)
    })
  })

  describe('DELETE /api/comments/[id]/react', () => {
    it('removes a reaction from a comment', async () => {
      const { getServerSession } = await import('next-auth')
      const { prisma } = await import('@/lib/prisma')

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any)

      vi.mocked(prisma.commentReaction.deleteMany).mockResolvedValue({ count: 1 } as any)

      const request = new NextRequest('http://localhost/api/comments/comment1/react', {
        method: 'DELETE',
      })

      const response = await removeReaction(request, { params: { id: 'comment1' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})
