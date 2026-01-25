import { render, screen, waitFor } from '@testing-library/react'
import FeedPage from '../page'
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock PredictionCard to simplify testing
vi.mock('@/components/predictions/PredictionCard', () => ({
  default: () => <div data-testid="prediction-card">Card</div>
}))

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock for each test
    mockFetch.mockReset()
  })

  it('renders loading state initially', () => {
    mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ predictions: [] }),
    } as Response)
    render(<FeedPage />)
    expect(screen.getByText('Loading your feed...')).toBeInTheDocument()
  })

  it('renders predictions when API returns data', async () => {
    const mockPredictions = [{ id: '1', title: 'Test' }]
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ predictions: mockPredictions }),
    } as Response)

    render(<FeedPage />)

    await waitFor(() => {
      expect(screen.getByTestId('prediction-card')).toBeInTheDocument()
    })
  })

  it('handles empty API response gracefully (prevents crash)', async () => {
    // Simulate API returning valid JSON but missing 'predictions' array
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ someOtherData: 'unexpected' }),
    } as Response)

    render(<FeedPage />)

    // Should render empty state or at least NOT crash
    await waitFor(() => {
        expect(screen.queryByText('Loading your feed...')).not.toBeInTheDocument()
    })
    
    // Check for empty state text
    expect(screen.getByText('No active predictions')).toBeInTheDocument()
  })
})
