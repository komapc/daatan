import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { getServerSession } from 'next-auth'

vi.mock('next-auth', () => ({
    getServerSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        prediction: {
            findMany: vi.fn(),
            create: vi.fn(),
            count: vi.fn(),
            findUnique: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        newsAnchor: {
            upsert: vi.fn(),
        }
    },
}))

// Mock slugify utility if needed, but it seems to be imported dynamically.
// However, since it's an external module, we might not need to mock it if it doesn't have side effects.
// But wait, it uses crypto.

describe('/api/forecasts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetAllMocks()
    })

    describe('GET', () => {
        it('returns a list of forecasts', async () => {
            const { prisma } = await import('@/lib/prisma')

            const mockForecasts = [
                {
                    id: '1',
                    claimText: 'Forecast 1',
                    status: 'ACTIVE',
                    author: { id: 'u1', username: 'user1' },
                    _count: { commitments: 0 },
                    commitments: []
                },
                {
                    id: '2',
                    claimText: 'Forecast 2',
                    status: 'PENDING',
                    author: { id: 'u2', username: 'user2' },
                    _count: { commitments: 5 },
                    commitments: []
                },
            ]

            vi.mocked(prisma.prediction.findMany).mockResolvedValue(mockForecasts as any)
            vi.mocked(prisma.prediction.count).mockResolvedValue(2)

            const request = new NextRequest('http://localhost/api/forecasts')
            const response = await GET(request)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.predictions).toHaveLength(2)
            expect(data.predictions[0].claimText).toBe('Forecast 1')
        })
    })

    describe('POST', () => {
        it('creates a new forecast when authenticated', async () => {
            const { prisma } = await import('@/lib/prisma')

            vi.mocked(getServerSession).mockResolvedValue({
                user: { id: 'user1', email: 'user@example.com' },
            } as any)

            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                id: 'user1',
                rs: 100,
            } as any)

            const newForecast = {
                id: 'new-1',
                claimText: 'New Forecast',
                status: 'DRAFT',
            }

            vi.mocked(prisma.prediction.create).mockResolvedValue(newForecast as any)
            vi.mocked(prisma.prediction.findUnique).mockResolvedValue(newForecast as any)
            // Mock findMany for slug check
            vi.mocked(prisma.prediction.findMany).mockResolvedValue([])

            const body = {
                claimText: 'New Forecast',
                resolveByDatetime: '2026-12-31T23:59:59Z',
                outcomeType: 'BINARY',
            }

            const request = new NextRequest('http://localhost/api/forecasts', {
                method: 'POST',
                body: JSON.stringify(body),
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(201)
            expect(data.id).toBe('new-1')
            expect(prisma.prediction.create).toHaveBeenCalled()
        })

        it('returns 401 when not authenticated', async () => {
            vi.mocked(getServerSession).mockResolvedValue(null)

            const body = {
                claimText: 'New Forecast',
            }

            const request = new NextRequest('http://localhost/api/forecasts', {
                method: 'POST',
                body: JSON.stringify(body),
            })

            const response = await POST(request)
            expect(response.status).toBe(401)
        })
    })
})
