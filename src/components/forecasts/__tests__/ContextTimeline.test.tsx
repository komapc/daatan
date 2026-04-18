import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import ContextTimeline from '../ContextTimeline'
import enMessages from '../../../../messages/en.json'

const mockFetch = vi.fn()

const renderWithIntl = (ui: React.ReactElement) => {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>
  )
}

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
    await act(async () => {
      renderWithIntl(<ContextTimeline predictionId="p1" canAnalyze={true} />)
    })
    expect(screen.getByText(enMessages.context.title)).toBeInTheDocument()
  })

  it('shows analyze button when canAnalyze is true', async () => {
    await act(async () => {
      renderWithIntl(<ContextTimeline predictionId="p1" canAnalyze={true} />)
    })
    expect(screen.getByText(enMessages.context.analyze)).toBeInTheDocument()
  })

  it('hides analyze button when canAnalyze is false', async () => {
    await act(async () => {
      renderWithIntl(<ContextTimeline predictionId="p1" canAnalyze={false} />)
    })
    expect(screen.queryByText(enMessages.context.analyze)).not.toBeInTheDocument()
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

    await act(async () => {
      renderWithIntl(
        <ContextTimeline
          predictionId="p1"
          initialContext="Current situation summary"
          canAnalyze={false}
        />
      )
    })

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

    renderWithIntl(<ContextTimeline predictionId="p1" canAnalyze={false} />)

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

    renderWithIntl(<ContextTimeline predictionId="p1" canAnalyze={false} />)

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

    renderWithIntl(<ContextTimeline predictionId="p1" canAnalyze={false} />)

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

    renderWithIntl(<ContextTimeline predictionId="p1" canAnalyze={true} />)

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

    fireEvent.click(screen.getByText(enMessages.context.analyze))

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

    renderWithIntl(<ContextTimeline predictionId="p1" canAnalyze={false} />)

    await waitFor(() => {
      expect(screen.getByText('Reuters')).toBeInTheDocument()
    })

    const link = screen.getByText('Reuters').closest('a')
    expect(link).toHaveAttribute('href', 'https://reuters.com/big-news')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('renders Oracle CI text and sources when oracleSnapshot is present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        currentContext: 'Oracle-backed context',
        contextUpdatedAt: '2026-02-20T10:00:00Z',
        snapshots: [
          {
            id: 's1',
            summary: 'Oracle-backed context',
            sources: [],
            createdAt: '2026-02-20T10:00:00Z',
            externalProbability: 64,
            externalReasoning: 'TruthMachine Oracle (calibrated multi-source estimate)',
            oracleSnapshot: {
              mean: 0.28,
              std: 0.12,
              ciLow: 52,
              ciHigh: 76,
              articlesUsed: 3,
              sources: [
                {
                  sourceId: 'reuters',
                  sourceName: 'Reuters',
                  url: 'https://reuters.com/x',
                  stance: 0.7,
                  certainty: 0.85,
                  credibilityWeight: 0.95,
                  claims: ['Claim A'],
                },
                {
                  sourceId: 'blog',
                  sourceName: 'Random Blog',
                  url: 'https://blog.example.com/x',
                  stance: -0.4,
                  certainty: 0.3,
                  credibilityWeight: 0.25,
                  claims: ['Claim B'],
                },
              ],
            },
          },
        ],
      }),
    })

    renderWithIntl(<ContextTimeline predictionId="p1" canAnalyze={false} />)

    // Spread shown as ±halfWidth (ciHigh=76, ciLow=52 → (76-52)/2 = 12)
    await waitFor(() => {
      expect(screen.getByText(/± 12%/)).toBeInTheDocument()
    })

    // Articles-used suffix appended to reasoning
    expect(screen.getByText(/3 articles/)).toBeInTheDocument()

    // Oracle sources sub-section with both sources rendered as chips
    const oracleSection = screen.getByTestId('oracle-sources')
    expect(oracleSection).toBeInTheDocument()
    expect(screen.getByText('Reuters')).toBeInTheDocument()
    expect(screen.getByText('Random Blog')).toBeInTheDocument()

    // Stance badges (YES for positive stance, NO for negative)
    expect(screen.getAllByText('YES').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('NO').length).toBeGreaterThanOrEqual(1)

    // Source chip links open in a new tab
    const reutersChip = screen.getByText('Reuters').closest('a')
    expect(reutersChip).toHaveAttribute('href', 'https://reuters.com/x')
    expect(reutersChip).toHaveAttribute('target', '_blank')
  })

  it('omits the Oracle sources sub-section when oracleSnapshot is null', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        currentContext: 'LLM-fallback context',
        contextUpdatedAt: '2026-02-20T10:00:00Z',
        snapshots: [
          {
            id: 's1',
            summary: 'LLM-fallback context',
            sources: [],
            createdAt: '2026-02-20T10:00:00Z',
            externalProbability: 55,
            externalReasoning: 'Based on articles',
            oracleSnapshot: null,
          },
        ],
      }),
    })

    renderWithIntl(<ContextTimeline predictionId="p1" canAnalyze={false} />)

    await waitFor(() => {
      expect(screen.getByText('55%')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('oracle-sources')).toBeNull()
    expect(screen.queryByText(/±/)).toBeNull()
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

    renderWithIntl(<ContextTimeline predictionId="p1" canAnalyze={false} />)

    await waitFor(() => {
      expect(screen.getByText('2 previous updates')).toBeInTheDocument()
    })
  })
})
