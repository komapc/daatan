import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ResolutionForm } from '../ResolutionForm'

const mockFetch = vi.fn()

describe('ResolutionForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
  })

  it('renders outcome options and submit button', () => {
    render(<ResolutionForm predictionId="pred-1" outcomeType="BINARY" options={[]} />)

    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText('Wrong')).toBeInTheDocument()
    expect(screen.getByText('Void')).toBeInTheDocument()
    expect(screen.getByText('Unresolvable')).toBeInTheDocument()
    const submitButtons = screen.getAllByRole('button', { name: /Confirm Resolution/i })
    expect(submitButtons.length).toBeGreaterThan(0)
  })

  it('calls resolve API on submit with correct outcome', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    render(<ResolutionForm predictionId="pred-1" outcomeType="BINARY" options={[]} onResolved={vi.fn()} />)

    fireEvent.click(screen.getByText('Correct'))
    const submitButton = screen.getAllByRole('button', { name: /Resolve Forecast/i })[0]
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/forecasts/pred-1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: 'correct',
          evidenceLinks: undefined,
          resolutionNote: undefined,
        }),
      })
    })
  })

  it('calls onResolved callback when resolution succeeds', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    const onResolved = vi.fn()

    render(<ResolutionForm predictionId="pred-1" outcomeType="BINARY" options={[]} onResolved={onResolved} />)

    const submitButton = screen.getAllByRole('button', { name: /Resolve Forecast/i })[0]
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onResolved).toHaveBeenCalled()
    })
  })

  it('sends selected outcome when different option chosen', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    render(<ResolutionForm predictionId="pred-1" outcomeType="BINARY" options={[]} />)

    fireEvent.click(screen.getByText('Wrong'))
    const submitButton = screen.getAllByRole('button', { name: /Resolve Forecast/i })[0]
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.outcome).toBe('wrong')
    })
  })

  it('displays error when API returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Prediction not found' }),
    })

    render(<ResolutionForm predictionId="pred-1" outcomeType="BINARY" options={[]} />)

    const submitButton = screen.getAllByRole('button', { name: /Resolve Forecast/i })[0]
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Prediction not found')).toBeInTheDocument()
    })
  })

  it('includes evidence links when provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    render(<ResolutionForm predictionId="pred-1" outcomeType="BINARY" options={[]} />)

    const evidenceTextarea = document.getElementById('evidence') as HTMLTextAreaElement
    fireEvent.change(evidenceTextarea, {
      target: { value: 'https://example.com/1\nhttps://example.com/2' },
    })
    const submitButton = screen.getAllByRole('button', { name: /Resolve Forecast/i })[0]
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.evidenceLinks).toEqual(['https://example.com/1', 'https://example.com/2'])
    })
  })
})
