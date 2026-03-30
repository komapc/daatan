import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/signup/route'
import bcrypt from 'bcryptjs'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(mockTx)),
  },
}))

const mockTx = {
  user: {
    create: vi.fn(),
  },
  cuTransaction: {
    create: vi.fn(),
  },
}

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
  },
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('successfully creates a new user', async () => {
    const { prisma } = await import('@/lib/prisma')
    
    // 1. No existing user
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    // 2. No collisions
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    // 3. User creation result
    mockTx.user.create.mockResolvedValue({
      id: 'new-user-id',
      name: 'Test User',
      email: 'test@example.com',
      username: 'test_user',
    })

    const body = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    }

    const req = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.email).toBe('test@example.com')
    expect(data.username).toBe('test_user')
    
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12)
    expect(mockTx.user.create).toHaveBeenCalled()
    expect(mockTx.cuTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'INITIAL_GRANT',
        amount: 100,
      })
    }))
  })

  it('returns 400 if user email already exists', async () => {
    const { prisma } = await import('@/lib/prisma')
    
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing-id' } as any)

    const body = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    }

    const req = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('already exists')
  })

  it('validates input data', async () => {
    const body = {
      name: '', // Invalid
      email: 'invalid-email', // Invalid
      password: 'short', // Invalid
    }

    const req = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
