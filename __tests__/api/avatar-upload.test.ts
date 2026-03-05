import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mocking ---
const { mockGetServerSession, mockPrisma, mockS3Send, mockSharp } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockPrisma: {
    user: {
      update: vi.fn(),
    },
  },
  mockS3Send: vi.fn(),
  mockSharp: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-processed-image')),
  })),
}))

vi.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class {
      send = mockS3Send
    },
    PutObjectCommand: class {
      constructor(public args: any) {}
    },
  }
})

vi.mock('sharp', () => ({
  default: mockSharp,
}))

import { POST } from '@/app/api/profile/avatar/route'

// --- Helper to create FormData request ---
function createUploadRequest(file: File | null) {
  const formData = new FormData()
  if (file) {
    formData.append('avatar', file)
  }
  return new NextRequest('http://localhost/api/profile/avatar', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/profile/avatar', () => {
  const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test User' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSession.mockResolvedValue({ user: mockUser })
    process.env.AWS_ACCOUNT_ID = '123456789012'
    process.env.APP_ENV = 'staging'
  })

  it('returns 401 if not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const req = createUploadRequest(new File([''], 'test.jpg', { type: 'image/jpeg' }))
    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(401)
  })

  it('returns 400 if no file provided', async () => {
    const req = createUploadRequest(null)
    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('No file provided')
  })

  it('returns 400 if file is not an image', async () => {
    const req = createUploadRequest(new File(['hello'], 'test.txt', { type: 'text/plain' }))
    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('must be an image')
  })

  it('successfully uploads and updates user avatarUrl', async () => {
    const file = new File(['fake-image-content'], 'avatar.jpg', { type: 'image/jpeg' })
    const req = createUploadRequest(file)

    mockS3Send.mockResolvedValue({})
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', avatarUrl: 'http://s3/path' })

    const res = await POST(req, { params: Promise.resolve({}) })
    
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.avatarUrl).toBeDefined()
    expect(data.avatarUrl).toContain('daatan-uploads-staging-123456789012.s3.eu-central-1.amazonaws.com/avatars/user-1/')

    // Verify sharp was called
    expect(mockSharp).toHaveBeenCalled()
    
    // Verify S3 was called
    expect(mockS3Send).toHaveBeenCalled()
    
    // Verify Prisma update
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarUrl: data.avatarUrl }
    })
  })

  it('returns 500 if S3 upload fails', async () => {
    const file = new File(['fake-image-content'], 'avatar.jpg', { type: 'image/jpeg' })
    const req = createUploadRequest(file)

    mockS3Send.mockRejectedValue(new Error('S3 Down'))

    const res = await POST(req, { params: Promise.resolve({}) })
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Failed to upload avatar')
  })
})
