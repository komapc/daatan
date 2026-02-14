import { render, screen, waitFor } from '@testing-library/react'
import FeedClient from '../FeedClient'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock ForecastCard to simplify testing
vi.mock('@/components/forecasts/ForecastCard', () => ({
  default: () => <div data-testid="prediction-card">Card</div>
}))

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it('renders loading state initially', () => {
    mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ predictions: [] }),
    } as Response)
    render(<FeedClient />)
    expect(screen.getByText('Loading your feed...')).toBeInTheDocument()
  })

  it('renders predictions when API returns data', async () => {
    const mockPredictions = [{ id: '1', title: 'Test' }]
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ predictions: mockPredictions }),
    } as Response)

    render(<FeedClient />)

    await waitFor(() => {
      expect(screen.getByTestId('prediction-card')).toBeInTheDocument()
    })
  })

  it('handles empty API response gracefully (prevents crash)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ someOtherData: 'unexpected' }),
    } as Response)

    render(<FeedClient />)

    await waitFor(() => {
        expect(screen.queryByText('Loading your feed...')).not.toBeInTheDocument()
    })
    
    expect(screen.getByText('No active predictions')).toBeInTheDocument()
  })
})
