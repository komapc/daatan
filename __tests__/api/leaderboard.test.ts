/**
 * @jest-environment node
 */
import { GET } from '@/app/api/top-reputation/route'
import { NextRequest } from 'next/server'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
  },
}))

describe('Leaderboard API', () => {
  let prisma: { user: { findMany: ReturnType<typeof vi.fn> } }

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/lib/prisma')
    prisma = mod.prisma as unknown as typeof prisma
  })

  it('returns a list of top users', async () => {
    const mockUsers = [
      { id: '1', username: 'user1', rs: 100 },
      { id: '2', username: 'user2', rs: 90 },
    ]
    
    vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as never)

    const request = new NextRequest('http://localhost/api/top-reputation?limit=10')
    const response = await GET(request)
    const data = await response.json()

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { isPublic: true },
      select: expect.any(Object),
      orderBy: { rs: 'desc' },
      take: 10,
    })
    
    expect(data).toHaveProperty('users')
    expect(data.users).toHaveLength(2)
    expect(data.users[0].username).toBe('user1')
  })

  it('handles database errors gracefully', async () => {
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error('DB Error'))

    const request = new NextRequest('http://localhost/api/top-reputation')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error', 'Failed to fetch leaderboard')
  })
})
