import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExpressForecastClient from '../ExpressForecastClient'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

describe('ExpressForecastClient', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders input form initially', () => {
    render(<ExpressForecastClient userId="test-user" />)
    expect(screen.getByText('What do you want to forecast?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Describe your event OR paste/)).toBeInTheDocument()
  })

  it('shows error for input less than 5 characters', async () => {
    render(<ExpressForecastClient userId="test-user" />)

    const input = screen.getByPlaceholderText(/Describe your event OR paste/)
    const button = screen.getByText('Generate Forecast')

    fireEvent.change(input, { target: { value: 'abc' } })

    // Button should be disabled for input < 5 chars
    expect(button).toBeDisabled()
  })

  it('disables button when input is empty', () => {
    render(<ExpressForecastClient userId="test-user" />)

    const button = screen.getByText('Generate Forecast')
    expect(button).toBeDisabled()
  })

  it('enables button when input is valid', () => {
    render(<ExpressForecastClient userId="test-user" />)

    const input = screen.getByPlaceholderText(/Describe your event OR paste/)
    const button = screen.getByText('Generate Forecast')

    fireEvent.change(input, { target: { value: 'Bitcoin will reach $100k' } })

    expect(button).not.toBeDisabled()
  })

  it('shows character count', () => {
    render(<ExpressForecastClient userId="test-user" />)

    const input = screen.getByPlaceholderText(/Describe your event OR paste/)

    fireEvent.change(input, { target: { value: 'Test input' } })

    expect(screen.getByText('10/1000 characters')).toBeInTheDocument()
  })

  it('renders example predictions', () => {
    render(<ExpressForecastClient userId="test-user" />)

    expect(screen.getByText('Examples:')).toBeInTheDocument()
    expect(screen.getByText(/Bitcoin will reach \$100k/)).toBeInTheDocument()
  })

  it('fills input when clicking example', () => {
    render(<ExpressForecastClient userId="test-user" />)

    const example = screen.getByText(/Bitcoin will reach \$100k/)
    fireEvent.click(example)

    const input = screen.getByPlaceholderText(/Describe your event OR paste/) as HTMLTextAreaElement
    expect(input.value).toContain('Bitcoin')
  })

  // ── Review & Publish flow (tests the handoff to ForecastWizard) ─────────

  describe('handleCreatePrediction (Review & Publish)', () => {
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
        snippet: 'Bitcoin is booming',
      },
      additionalLinks: [],
    }

    /**
     * Helper: put the component into "review" state by simulating a
     * successful generation via a mocked fetch stream.
     */
    const renderInReviewState = async () => {
      // Build a streaming response that goes straight to "complete"
      const streamBody = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify({ stage: 'complete', data: generatedData }) + '\n')
          )
          controller.close()
        },
      })

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(streamBody, { status: 200 })
      )

      render(<ExpressForecastClient userId="test-user" />)

      // Type a valid input and click Generate
      const input = screen.getByPlaceholderText(/Describe your event OR paste/)
      fireEvent.change(input, { target: { value: 'Bitcoin will reach $100k this year' } })
      fireEvent.click(screen.getByText('Generate Forecast'))

      // Wait for the review screen to appear
      const reviewButton = await screen.findByText('Review & Publish', {}, { timeout: 3000 })
      return reviewButton
    }

    it('saves generated data to localStorage and redirects to /create?from=express', async () => {
      // Spy on window.location.href assignment
      const hrefSpy = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { ...window.location, href: '' },
        writable: true,
        configurable: true,
      })
      Object.defineProperty(window.location, 'href', {
        set: hrefSpy,
        get: () => '',
        configurable: true,
      })

      const reviewButton = await renderInReviewState()
      fireEvent.click(reviewButton)

      // Verify localStorage was populated with the generated data
      const stored = localStorage.getItem('expressPredictionData')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.claimText).toBe(generatedData.claimText)
      expect(parsed.resolveByDatetime).toBe(generatedData.resolveByDatetime)

      // Verify redirect was triggered
      expect(hrefSpy).toHaveBeenCalledWith('/create?from=express')
    })

    it('renders Review Forecast heading after successful generation', async () => {
      await renderInReviewState()

      expect(screen.getByText('Review Forecast')).toBeInTheDocument()
      expect(screen.getByText(generatedData.claimText)).toBeInTheDocument()
    })
  })
})
