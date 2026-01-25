/**
 * @jest-environment node
 */
import { GET } from '@/app/api/health/route'
import { NextResponse } from 'next/server'
import { vi, describe, it, expect } from 'vitest'

// Mock the version module
vi.mock('@/lib/version', () => ({
  VERSION: '0.1.4'
}))

describe('Health and Version API', () => {
  it('returns the correct status and version structure', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response).toBeInstanceOf(NextResponse)
    expect(data).toHaveProperty('version', '0.1.4')
    expect(data).toHaveProperty('status', 'ok')
  })
})
