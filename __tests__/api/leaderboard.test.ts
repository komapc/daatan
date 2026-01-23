/**
 * @jest-environment node
 */
import { GET } from '../route'
import { NextRequest } from 'next/server'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Prisma
const prismaMock = {
  user: {
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('Leaderboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a list of top users', async () => {
    const mockUsers = [
      { id: '1', username: 'user1', rs: 100 },
      { id: '2', username: 'user2', rs: 90 },
    ]
    
    prismaMock.user.findMany.mockResolvedValue(mockUsers)

    const request = new NextRequest('http://localhost/api/top-reputation?limit=10')
    const response = await GET(request)
    const data = await response.json()

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
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
    prismaMock.user.findMany.mockRejectedValue(new Error('DB Error'))

    const request = new NextRequest('http://localhost/api/top-reputation')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error', 'Failed to fetch leaderboard')
  })
})
