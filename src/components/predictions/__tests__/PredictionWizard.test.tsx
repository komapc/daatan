import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PredictionWizard } from '../PredictionWizard'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('PredictionWizard', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Clear URL search params
    delete (window as any).location
    ;(window as any).location = { search: '' }
  })

  it('renders with empty form by default', () => {
    render(<PredictionWizard />)
    expect(screen.getByText('News Anchor')).toBeInTheDocument()
  })

  it('loads express prediction data from localStorage on mount', async () => {
    const expressData = {
      claimText: 'Bitcoin will reach $100k',
      resolveByDatetime: '2026-12-31T23:59:59Z',
      detailsText: 'Bitcoin has been rising',
      domain: 'economics',
      newsAnchor: {
        url: 'https://example.com/article',
        title: 'Bitcoin News',
      },
    }

    localStorage.setItem('expressPredictionData', JSON.stringify(expressData))

    render(<PredictionWizard isExpressFlow={true} />)

    // Data should be removed from localStorage after loading
    await waitFor(() => {
      expect(localStorage.getItem('expressPredictionData')).toBeNull()
    })
  })

  it('does not load data when not from express', () => {
    const expressData = {
      claimText: 'Bitcoin will reach $100k',
      resolveByDatetime: '2026-12-31T23:59:59Z',
    }

    localStorage.setItem('expressPredictionData', JSON.stringify(expressData))

    render(<PredictionWizard isExpressFlow={false} />)

    // Data should remain in localStorage
    expect(localStorage.getItem('expressPredictionData')).toBeTruthy()
  })

  it('handles invalid JSON in localStorage gracefully', () => {
    localStorage.setItem('expressPredictionData', 'invalid json')

    // Should not throw
    expect(() => render(<PredictionWizard isExpressFlow={true} />)).not.toThrow()
  })

  it('handles missing localStorage data gracefully', () => {
    // Should not throw
    expect(() => render(<PredictionWizard isExpressFlow={true} />)).not.toThrow()
  })
})
