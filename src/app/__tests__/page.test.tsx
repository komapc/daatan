import { render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import FeedClient from '../FeedClient'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import messages from '../../../messages/en.json'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock ForecastCard to simplify testing
vi.mock('@/components/forecasts/ForecastCard', () => ({
  default: () => <div data-testid="prediction-card">Card</div>
}))

const renderWithIntl = (ui: React.ReactElement) =>
  render(<NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>)

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
    renderWithIntl(<FeedClient />)
    expect(screen.getByText(messages.feed.loading)).toBeInTheDocument()
  })

  it('renders predictions when API returns data', async () => {
    const mockPredictions = [{ id: '1', title: 'Test' }]
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ predictions: mockPredictions }),
    } as Response)

    renderWithIntl(<FeedClient />)

    await waitFor(() => {
      expect(screen.getByTestId('prediction-card')).toBeInTheDocument()
    })
  })

  it('handles empty API response gracefully (prevents crash)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ someOtherData: 'unexpected' }),
    } as Response)

    renderWithIntl(<FeedClient />)

    await waitFor(() => {
      expect(screen.queryByText(messages.feed.loading)).not.toBeInTheDocument()
    })

    expect(screen.getByText(messages.feed.empty)).toBeInTheDocument()
  })
})
