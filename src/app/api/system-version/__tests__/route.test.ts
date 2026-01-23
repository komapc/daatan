/**
 * @jest-environment node
 */
import { GET } from '../route'
import { NextResponse } from 'next/server'

// Mock the version module
vi.mock('@/lib/version', () => ({
  VERSION: '0.1.4'
}))

describe('System Version API', () => {
  it('returns the correct version structure', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response).toBeInstanceOf(NextResponse)
    expect(data).toHaveProperty('version', '0.1.4')
    expect(data).toHaveProperty('status', 'version-check')
  })
})
