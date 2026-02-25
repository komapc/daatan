import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ContextTimeline from '../ContextTimeline'

const mockFetch = vi.fn()

describe('ContextTimeline', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    global.fetch = mockFetch
    // Default: GET returns empty timeline
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ currentContext: null, contextUpdatedAt: null, snapshots: [] }),
    })
  })

  it('renders section header', async () => {
    render(<ContextTimeline predictionId="p1" canAnalyze={true} />)
    expect(screen.getByText('Situation Context')).toBeInTheDocument()
  })

  it('shows analyze button when canAnalyze is true', () => {
    render(<ContextTimeline predictionId="p1" canAnalyze={true} />)
    expect(screen.getByText('Analyze Situation')).toBeInTheDocument()
  })

  it('hides analyze button when canAnalyze is false', () => {
    render(<ContextTimeline predictionId="p1" canAnalyze={false} />)
    expect(screen.queryByText('Analyze Situation')).not.toBeInTheDocument()
  })

  it('displays initial context', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        currentContext: 'Current situation summary',
        contextUpdatedAt: '2026-02-20T10:00:00Z',
        snapshots: [{ id: 's1', summary: 'Current situation summary', sources: [], createdAt: '2026-02-20T10:00:00Z' }],
      }),
    })

    render(
      <ContextTimeline
        predictionId="p1"
        initialContext="Current situation summary"
        canAnalyze={false}
      />
    )

    expect(screen.getByText('Current situation summary')).toBeInTheDocument()
  })

  it('fetches timeline on mount', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        currentContext: 'Fetched context',
        contextUpdatedAt: '2026-02-20T10:00:00Z',
        snapshots: [{ id: 's1', summary: 'Fetched context', sources: [], createdAt: '2026-02-20T10:00:00Z' }],
      }),
    })

    render(<ContextTimeline predictionId="p1" canAnalyze={false} />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/forecasts/p1/context')
    })

    await waitFor(() => {
      expect(screen.getByText('Fetched context')).toBeInTheDocument()
    })
  })

  it('shows previous updates toggle when there are multiple snapshots', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        currentContext: 'Latest',
        contextUpdatedAt: '2026-02-20T10:00:00Z',
        snapshots: [
          { id: 's2', summary: 'Latest', sources: [], createdAt: '2026-02-20T10:00:00Z' },
          { id: 's1', summary: 'Older update', sources: [], createdAt: '2026-02-19T10:00:00Z' },
        ],
      }),
    })

    render(<ContextTimeline predictionId="p1" canAnalyze={false} />)

    await waitFor(() => {
      expect(screen.getByText('1 previous update')).toBeInTheDocument()
    })
  })

  it('expands timeline when toggle is clicked', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        currentContext: 'Latest',
        contextUpdatedAt: '2026-02-20T10:00:00Z',
        snapshots: [
          { id: 's2', summary: 'Latest', sources: [], createdAt: '2026-02-20T10:00:00Z' },
          { id: 's1', summary: 'Older update', sources: [], createdAt: '2026-02-19T10:00:00Z' },
        ],
      }),
    })

    render(<ContextTimeline predictionId="p1" canAnalyze={false} />)

    await waitFor(() => {
      expect(screen.getByText('1 previous update')).toBeInTheDocument()
    })

    // Older update should not be visible yet
    expect(screen.queryByText('Older update')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('1 previous update'))

    expect(screen.getByText('Older update')).toBeInTheDocument()
  })

  it('calls POST and updates state when analyze is clicked', async () => {
    // First call: GET on mount
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ currentContext: null, contextUpdatedAt: null, snapshots: [] }),
    })

    render(<ContextTimeline predictionId="p1" canAnalyze={true} />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // Second call: POST on analyze
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        newContext: 'Freshly analyzed context',
        contextUpdatedAt: '2026-02-20T12:00:00Z',
        snapshot: { id: 's1', summary: 'Freshly analyzed context', sources: [], createdAt: '2026-02-20T12:00:00Z' },
        timeline: [{ id: 's1', summary: 'Freshly analyzed context', sources: [], createdAt: '2026-02-20T12:00:00Z' }],
      }),
    })

    fireEvent.click(screen.getByText('Analyze Situation'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/forecasts/p1/context', { method: 'POST' })
    })

    await waitFor(() => {
      expect(screen.getByText('Freshly analyzed context')).toBeInTheDocument()
    })
  })

  it('shows source links from latest snapshot', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        currentContext: 'Context with sources',
        contextUpdatedAt: '2026-02-20T10:00:00Z',
        snapshots: [
          {
            id: 's1',
            summary: 'Context with sources',
            sources: [
              { title: 'Big News', url: 'https://reuters.com/big-news', source: 'Reuters', publishedDate: '2026-02-20' },
            ],
            createdAt: '2026-02-20T10:00:00Z',
          },
        ],
      }),
    })

    render(<ContextTimeline predictionId="p1" canAnalyze={false} />)

    await waitFor(() => {
      expect(screen.getByText('Reuters')).toBeInTheDocument()
    })

    const link = screen.getByText('Reuters').closest('a')
    expect(link).toHaveAttribute('href', 'https://reuters.com/big-news')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('pluralizes previous updates correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        currentContext: 'Latest',
        contextUpdatedAt: '2026-02-20T10:00:00Z',
        snapshots: [
          { id: 's3', summary: 'Latest', sources: [], createdAt: '2026-02-20T10:00:00Z' },
          { id: 's2', summary: 'Middle', sources: [], createdAt: '2026-02-19T10:00:00Z' },
          { id: 's1', summary: 'Oldest', sources: [], createdAt: '2026-02-18T10:00:00Z' },
        ],
      }),
    })

    render(<ContextTimeline predictionId="p1" canAnalyze={false} />)

    await waitFor(() => {
      expect(screen.getByText('2 previous updates')).toBeInTheDocument()
    })
  })
})
