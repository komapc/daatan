import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { ForecastWizard } from '../ForecastWizard'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('ForecastWizard', () => {
  beforeEach(() => {
    // Clear localStorage and sessionStorage before each test
    localStorage.clear()
    sessionStorage.clear()
    // Clear URL search params
    delete (window as any).location
      ; (window as any).location = { search: '' }
  })

  it('renders with empty form by default', () => {
    render(<ForecastWizard />)
    expect(screen.getByText('News Anchor')).toBeInTheDocument()
  })

  it('loads express forecast data from localStorage on mount', async () => {
    const expressData = {
      claimText: 'Bitcoin will reach $100k',
      resolveByDatetime: '2026-12-31T23:59:59Z',
      detailsText: 'Bitcoin has been rising',
      tags: ['Crypto', 'Finance'],
      resolutionRules: 'Resolved by CoinMarketCap',
      newsAnchor: {
        url: 'https://example.com/article',
        title: 'Bitcoin News',
        snippet: 'Bitcoin is booming'
      },
    }

    localStorage.setItem('expressPredictionData', JSON.stringify(expressData))

    await act(async () => {
      render(<ForecastWizard isExpressFlow={true} />)
    })

    // Data should be removed from localStorage after loading
    await waitFor(() => {
      expect(localStorage.getItem('expressPredictionData')).toBeNull()
    })
  })

  it('does not load data when not from express', () => {
    const expressData = {
      claimText: 'Bitcoin will reach $100k',
      resolveByDatetime: '2026-12-31T23:59:59Z',
      tags: ['Crypto'],
    }

    localStorage.setItem('expressPredictionData', JSON.stringify(expressData))

    render(<ForecastWizard isExpressFlow={false} />)

    // Data should remain in localStorage
    expect(localStorage.getItem('expressPredictionData')).toBeTruthy()
  })

  it('handles invalid JSON in localStorage gracefully', () => {
    localStorage.setItem('expressPredictionData', 'invalid json')

    // Should not throw
    expect(() => render(<ForecastWizard isExpressFlow={true} />)).not.toThrow()
  })

  it('handles missing localStorage data gracefully', () => {
    // Should not throw
    expect(() => render(<ForecastWizard isExpressFlow={true} />)).not.toThrow()
  })

  it('restores form data from sessionStorage on mount (manual flow)', async () => {
    const draft = {
      formData: {
        claimText: 'Restored claim text',
        tags: [],
        outcomeType: 'BINARY',
        resolveByDatetime: '',
        isPublic: true,
      },
      currentStep: 2,
    }
    sessionStorage.setItem('daatan:forecast-draft', JSON.stringify(draft))

    await act(async () => {
      render(<ForecastWizard isExpressFlow={false} />)
    })

    // Should be on step 2 (Prediction) with the claim text visible in the input
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/Bitcoin will reach/i) as HTMLInputElement
      expect(input.value).toBe('Restored claim text')
    })
  })

  it('does not restore sessionStorage in express flow', async () => {
    const draft = {
      formData: { claimText: 'Should not appear', tags: [], outcomeType: 'BINARY', resolveByDatetime: '', isPublic: true },
      currentStep: 2,
    }
    sessionStorage.setItem('daatan:forecast-draft', JSON.stringify(draft))

    await act(async () => {
      render(<ForecastWizard isExpressFlow={true} />)
    })

    // sessionStorage data should be ignored in express flow
    expect(screen.queryByDisplayValue('Should not appear')).toBeNull()
  })

  it('handles corrupt sessionStorage data gracefully', () => {
    sessionStorage.setItem('daatan:forecast-draft', 'not valid json {{{')
    expect(() => render(<ForecastWizard isExpressFlow={false} />)).not.toThrow()
  })

  it('converts ISO datetime to YYYY-MM-DD for the date input in express flow', async () => {
    const expressData = {
      claimText: 'Test prediction claim text',
      resolveByDatetime: '2026-12-31T23:59:59.000Z',
      detailsText: 'Some details',
      tags: ['AI'],
      resolutionRules: 'Check official sources',
      newsAnchor: {
        url: 'https://example.com',
        title: 'Article',
        snippet: 'Snippet',
      },
    }

    localStorage.setItem('expressPredictionData', JSON.stringify(expressData))

    await act(async () => {
      render(<ForecastWizard isExpressFlow={true} />)
    })

    // Navigate to step 3 (Outcome) where the date input is
    const nextButton = screen.getByRole('button', { name: /next/i })
    
    await act(async () => {
      fireEvent.click(nextButton)
    })

    await waitFor(() => {
      const dateInput = screen.getByLabelText(/Resolution Deadline/i) as HTMLInputElement
      // Should be YYYY-MM-DD, not the full ISO string
      expect(dateInput.value).toBe('2026-12-31')
    })
  })
})
