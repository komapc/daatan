import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExpressForecastClient from '../ExpressForecastClient'

// Mock next/navigation
const mockRouter = {
  push: vi.fn(),
}

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

interface GeneratedPrediction {
  claimText: string
  resolveByDatetime: string
  detailsText: string
  tags: string[]
  resolutionRules: string
  outcomeType: 'BINARY' | 'MULTIPLE_CHOICE'
  options: string[]
  newsAnchor: { url: string; title: string; snippet: string }
  additionalLinks: Array<{ url: string; title: string }>
}

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

  // ── Confirm & Publish flow (direct API integration) ───────────
  describe('handleCreatePrediction (Confirm & Publish)', () => {
    const generatedData: GeneratedPrediction = {
      claimText: 'Bitcoin will reach $100k',
      resolveByDatetime: '2026-12-31T23:59:59Z',
      detailsText: 'Context about Bitcoin',
      tags: ['Crypto', 'Finance'],
      resolutionRules: 'Resolved by CoinMarketCap',
      outcomeType: 'BINARY',
      options: [],
      newsAnchor: {
        url: 'https://example.com',
        title: 'Bitcoin News',
        snippet: 'Bitcoin is booming',
      },
      additionalLinks: [],
    }

    const renderInReviewState = async (data = generatedData) => {
      // 1. Mock the generation stream
      const streamBody = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify({ stage: 'complete', data }) + '\n')
          )
          controller.close()
        },
      })

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(streamBody, { status: 200 })
      )

      render(<ExpressForecastClient userId="test-user" />)

      const input = screen.getByPlaceholderText(/Describe your event OR paste/)
      fireEvent.change(input, { target: { value: 'Bitcoin will reach $100k this year' } })
      fireEvent.click(screen.getByText('Generate Forecast'))

      return await screen.findByText('Confirm & Publish', {}, { timeout: 3000 })
    }

    it('directly creates and publishes the prediction and redirects to the new page', async () => {
      const confirmButton = await renderInReviewState()

      // 2. Mock the creation API
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'new-id' }), { status: 201 })
      )
      // 3. Mock the publishing API
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'new-id', status: 'ACTIVE' }), { status: 200 })
      )

      fireEvent.click(confirmButton)

      // Verify immediate feedback
      expect(screen.getByText('Publishing...')).toBeInTheDocument()

      // Wait for redirect
      await vi.waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/forecasts/new-id?newly_created=true')
      })
    })

    it('renders Review Forecast heading after successful generation', async () => {
      await renderInReviewState()
      expect(screen.getByText('Review Forecast')).toBeInTheDocument()
      expect(screen.getByText(generatedData.claimText)).toBeInTheDocument()
    })

    it('shows Binary outcome type badge for binary predictions', async () => {
      await renderInReviewState()
      expect(screen.getByText(/Binary/)).toBeInTheDocument()
    })

    it('shows Multiple Choice badge and options for multiple choice predictions', async () => {
      const mcData: GeneratedPrediction = {
        ...generatedData,
        claimText: 'Who will win the 2028 US presidential election?',
        outcomeType: 'MULTIPLE_CHOICE',
        options: ['Candidate A', 'Candidate B', 'Candidate C', 'Other'],
      }

      await renderInReviewState(mcData)
      expect(screen.getByText('Multiple Choice')).toBeInTheDocument()
      expect(screen.getByText('Candidate A')).toBeInTheDocument()
    })

    it('sends isPublic: true by default when publishing', async () => {
      await renderInReviewState()

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'new-id' }), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'new-id', status: 'ACTIVE' }), { status: 200 }))

      fireEvent.click(screen.getByText('Confirm & Publish'))

      await vi.waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalled()
      })

      // calls[0] = generate stream, calls[1] = create, calls[2] = publish
      const createCall = vi.mocked(globalThis.fetch).mock.calls[1]
      const body = JSON.parse(createCall[1]?.body as string)
      expect(body.isPublic).toBe(true)
    })

    it('shows Public visibility toggle by default on review step', async () => {
      await renderInReviewState()
      expect(screen.getByText(/Public — visible in the feed/)).toBeInTheDocument()
    })

    it('toggles to Unlisted when visibility button is clicked', async () => {
      await renderInReviewState()

      fireEvent.click(screen.getByText(/Public — visible in the feed/))
      expect(screen.getByText(/Unlisted — only people with the link/)).toBeInTheDocument()
    })

    it('sends isPublic: false when set to Unlisted before publishing', async () => {
      await renderInReviewState()

      // Toggle to unlisted
      fireEvent.click(screen.getByText(/Public — visible in the feed/))

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'new-id' }), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'new-id', status: 'ACTIVE' }), { status: 200 }))

      fireEvent.click(screen.getByText('Confirm & Publish'))

      await vi.waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalled()
      })

      // calls[0] = generate stream, calls[1] = create, calls[2] = publish
      const createCall = vi.mocked(globalThis.fetch).mock.calls[1]
      const body = JSON.parse(createCall[1]?.body as string)
      expect(body.isPublic).toBe(false)
    })

    it('shows edit form when Edit button clicked', async () => {
      await renderInReviewState()

      fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))

      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    it('hides visibility toggle during edit mode', async () => {
      await renderInReviewState()

      const editBtn = screen.getByRole('button', { name: /edit/i })
      fireEvent.click(editBtn)

      expect(screen.queryByText(/Public — visible in the feed/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Unlisted — only people with the link/)).not.toBeInTheDocument()
    })

    it('reverts button when publish API fails', async () => {
      await renderInReviewState()

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      )

      fireEvent.click(screen.getByText('Confirm & Publish'))

      // Button should revert from "Publishing..." back to normal after failure
      await vi.waitFor(() => {
        expect(screen.getByText('Confirm & Publish')).toBeInTheDocument()
      })
      expect(screen.queryByText('Publishing...')).not.toBeInTheDocument()
    })
  })
})
