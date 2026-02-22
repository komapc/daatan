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
  tags: [],
  _count: {
    commitments: 0,
  },
  totalCuCommitted: 0,
  userHasCommitted: false,
}

describe('ForecastCard tag display', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    } as any)
  })

  it('renders tag pills when tags are present', () => {
    const prediction = {
      ...basePrediction,
      tags: [{ name: 'AI' }, { name: 'Crypto' }],
    }
    render(<ForecastCard prediction={prediction} />)

    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('Crypto')).toBeInTheDocument()
  })

  it('does not render tag section when tags array is empty', () => {
    render(<ForecastCard prediction={basePrediction} />)

    expect(screen.queryByText('AI')).toBeNull()
    expect(screen.queryByText('Crypto')).toBeNull()
  })

  it('does not render tag section when tags is undefined', () => {
    const { tags, ...predictionWithoutTags } = basePrediction
    render(<ForecastCard prediction={predictionWithoutTags as Prediction} />)

    expect(screen.queryByText('AI')).toBeNull()
  })
})

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

    expect(screen.queryByTitle(/Edit Forecast/i)).toBeNull()
    expect(screen.queryByTitle(/Delete Forecast/i)).toBeNull()
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

    expect(screen.queryByTitle(/Edit Forecast/i)).toBeNull()
    expect(screen.queryByTitle(/Delete Forecast/i)).toBeNull()
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
    expect(screen.getByTitle(/Edit Forecast/i)).toBeInTheDocument()
    expect(screen.getByTitle(/Delete Forecast/i)).toBeInTheDocument()
  })
})

