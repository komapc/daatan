import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSession } from 'next-auth/react'
import ForecastCard, { Prediction } from '../ForecastCard'

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}))

const basePrediction: Prediction = {
  id: 'pred-1',
  claimText: 'Test prediction',
  domain: 'politics',
  outcomeType: 'BINARY',
  status: 'ACTIVE',
  resolveByDatetime: new Date().toISOString(),
  author: {
    id: 'user-1',
    name: 'Author',
    username: 'author',
    image: null,
    rs: 100,
    role: 'USER',
  },
  newsAnchor: null,
  _count: {
    commitments: 0,
  },
  totalCuCommitted: 0,
  userHasCommitted: false,
}

describe('ForecastCard moderation controls', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('does not show moderation controls when showModerationControls is false', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { role: 'ADMIN' },
        expires: 'any',
      } as any,
      status: 'authenticated',
    } as any)

    render(<ForecastCard prediction={basePrediction} />)

    expect(screen.queryByTitle(/Edit Prediction/i)).toBeNull()
    expect(screen.queryByTitle(/Delete Prediction/i)).toBeNull()
  })

  it('does not show Edit/Delete for resolvers but shows Resolve for active predictions', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { role: 'RESOLVER' },
        expires: 'any',
      } as any,
      status: 'authenticated',
    } as any)

    render(<ForecastCard prediction={basePrediction} showModerationControls />)

    expect(screen.queryByTitle(/Edit Prediction/i)).toBeNull()
    expect(screen.queryByTitle(/Delete Prediction/i)).toBeNull()
    expect(screen.getByTitle(/Resolve forecast/i)).toBeInTheDocument()
  })

  it('does not show Resolve for resolved predictions', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { role: 'RESOLVER' },
        expires: 'any',
      } as any,
      status: 'authenticated',
    } as any)

    const resolvedPrediction = { ...basePrediction, status: 'RESOLVED_CORRECT' as const }
    render(<ForecastCard prediction={resolvedPrediction} showModerationControls />)

    expect(screen.queryByTitle(/Resolve forecast/i)).toBeNull()
  })

  it('shows moderation controls for admins when flag is true', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { role: 'ADMIN' },
        expires: 'any',
      } as any,
      status: 'authenticated',
    } as any)

    render(<ForecastCard prediction={basePrediction} showModerationControls />)

    expect(screen.getByTitle(/Resolve forecast/i)).toBeInTheDocument()
    expect(screen.getByTitle(/Edit Prediction/i)).toBeInTheDocument()
    expect(screen.getByTitle(/Delete Prediction/i)).toBeInTheDocument()
  })
})

