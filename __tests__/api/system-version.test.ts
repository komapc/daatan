/**
 * @jest-environment node
 */
import { GET } from '@/app/api/health/route'
import { NextResponse } from 'next/server'
import { describe, it, expect } from 'vitest'

describe('Health and Version API', () => {
  it('returns the correct status and version structure', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response).toBeInstanceOf(NextResponse)
    expect(data).toHaveProperty('status', 'ok')
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('commit')
    expect(data).toHaveProperty('timestamp')
  })
})
