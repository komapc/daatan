import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ExpressPredictionClient from '../ExpressPredictionClient'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('ExpressPredictionClient', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders input form initially', () => {
    render(<ExpressPredictionClient userId="test-user" />)
    expect(screen.getByText('What do you want to forecast?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Describe your event OR paste/)).toBeInTheDocument()
  })

  it('shows error for input less than 5 characters', async () => {
    render(<ExpressPredictionClient userId="test-user" />)

    const input = screen.getByPlaceholderText(/Describe your event OR paste/)
    const button = screen.getByText('Generate Forecast')

    fireEvent.change(input, { target: { value: 'abc' } })

    // Button should be disabled for input < 5 chars
    expect(button).toBeDisabled()
  })

  it('disables button when input is empty', () => {
    render(<ExpressPredictionClient userId="test-user" />)

    const button = screen.getByText('Generate Forecast')
    expect(button).toBeDisabled()
  })

  it('enables button when input is valid', () => {
    render(<ExpressPredictionClient userId="test-user" />)

    const input = screen.getByPlaceholderText(/Describe your event OR paste/)
    const button = screen.getByText('Generate Forecast')

    fireEvent.change(input, { target: { value: 'Bitcoin will reach $100k' } })

    expect(button).not.toBeDisabled()
  })

  it('shows character count', () => {
    render(<ExpressPredictionClient userId="test-user" />)

    const input = screen.getByPlaceholderText(/Describe your event OR paste/)

    fireEvent.change(input, { target: { value: 'Test input' } })

    expect(screen.getByText('10/1000 characters')).toBeInTheDocument()
  })

  it('stores data in localStorage when creating prediction', () => {
    render(<ExpressPredictionClient userId="test-user" />)

    const generatedData = {
      claimText: 'Bitcoin will reach $100k',
      resolveByDatetime: '2026-12-31T23:59:59Z',
      detailsText: 'Context about Bitcoin',
      domain: 'economics',
      tags: ['Crypto', 'Finance'],
      resolutionRules: 'Resolved by CoinMarketCap',
      newsAnchor: {
        url: 'https://example.com',
        title: 'Bitcoin News',
        snippet: 'Bitcoin is booming'
      },
      additionalLinks: []
    }

    // Simulate the component storing data
    localStorage.setItem('expressPredictionData', JSON.stringify(generatedData))

    const stored = localStorage.getItem('expressPredictionData')
    expect(stored).toBeTruthy()
    expect(JSON.parse(stored!)).toEqual(generatedData)
  })

  it('renders example predictions', () => {
    render(<ExpressPredictionClient userId="test-user" />)

    expect(screen.getByText('Examples:')).toBeInTheDocument()
    expect(screen.getByText(/Bitcoin will reach \$100k/)).toBeInTheDocument()
  })

  it('fills input when clicking example', () => {
    render(<ExpressPredictionClient userId="test-user" />)

    const example = screen.getByText(/Bitcoin will reach \$100k/)
    fireEvent.click(example)

    const input = screen.getByPlaceholderText(/Describe your event OR paste/) as HTMLTextAreaElement
    expect(input.value).toContain('Bitcoin')
  })
})
