import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EditForecastClient from '../EditForecastClient'

// Mock next/navigation
const mockPush = vi.fn()
const mockParams = { id: 'pred-1' }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => mockParams,
}))

// Mock client-logger
vi.mock('@/lib/client-logger', () => ({
  createClientLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}))

const BASE_PREDICTION = {
  id: 'pred-1',
  slug: 'test-slug',
  claimText: 'Bitcoin will reach $100k',
  detailsText: 'Some context',
  outcomeType: 'BINARY',
  resolutionRules: 'Resolved by CoinMarketCap',
  resolveByDatetime: '2027-01-01T00:00:00.000Z',
  status: 'ACTIVE',
  isPublic: true,
  author: { id: 'user-1' },
}

function mockFetchLoad(prediction = BASE_PREDICTION) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(prediction), { status: 200 })
  )
}

describe('EditForecastClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner initially', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {})) // never resolves
    render(<EditForecastClient />)
    // Spinner renders during load — no form fields yet
    expect(screen.queryByLabelText(/Claim Text/)).not.toBeInTheDocument()
  })

  it('shows error when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 })
    )
    render(<EditForecastClient />)
    await waitFor(() => {
      expect(screen.getByText('Failed to load forecast')).toBeInTheDocument()
    })
  })

  it('loads form fields from API data', async () => {
    mockFetchLoad()
    render(<EditForecastClient />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Bitcoin will reach $100k')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('Some context')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Resolved by CoinMarketCap')).toBeInTheDocument()
  })

  it('shows forecast status in header', async () => {
    mockFetchLoad()
    render(<EditForecastClient />)

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Edit Forecast')).toBeInTheDocument()
  })

  it('shows "Public" visibility button when isPublic is true', async () => {
    mockFetchLoad()
    render(<EditForecastClient />)

    await waitFor(() => {
      expect(screen.getByText('Public')).toBeInTheDocument()
    })
    expect(screen.getByText('Visible in the public feed')).toBeInTheDocument()
  })

  it('shows "Unlisted" when loaded with isPublic: false', async () => {
    mockFetchLoad({ ...BASE_PREDICTION, isPublic: false })
    render(<EditForecastClient />)

    await waitFor(() => {
      expect(screen.getByText('Unlisted')).toBeInTheDocument()
    })
    expect(screen.getByText('Only people with the link can see this')).toBeInTheDocument()
  })

  it('toggles visibility from Public to Unlisted', async () => {
    mockFetchLoad()
    render(<EditForecastClient />)

    await waitFor(() => screen.getByText('Public'))

    fireEvent.click(screen.getByText('Public'))

    expect(screen.getByText('Unlisted')).toBeInTheDocument()
    expect(screen.getByText('Only people with the link can see this')).toBeInTheDocument()
  })

  it('toggles visibility from Unlisted back to Public', async () => {
    mockFetchLoad({ ...BASE_PREDICTION, isPublic: false })
    render(<EditForecastClient />)

    await waitFor(() => screen.getByText('Unlisted'))

    fireEvent.click(screen.getByText('Unlisted'))

    expect(screen.getByText('Public')).toBeInTheDocument()
    expect(screen.getByText('Visible in the public feed')).toBeInTheDocument()
  })

  it('shows "No changes to save" when nothing changed', async () => {
    mockFetchLoad()
    render(<EditForecastClient />)

    await waitFor(() => screen.getByText('Save Changes'))

    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByText('No changes to save')).toBeInTheDocument()
    })
  })

  it('sends only changed fields in PATCH payload', async () => {
    mockFetchLoad()
    render(<EditForecastClient />)

    await waitFor(() => screen.getByDisplayValue('Bitcoin will reach $100k'))

    // Change just the claimText
    fireEvent.change(screen.getByDisplayValue('Bitcoin will reach $100k'), {
      target: { value: 'Bitcoin will reach $200k' },
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ...BASE_PREDICTION, claimText: 'Bitcoin will reach $200k' }), {
        status: 200,
      })
    )

    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByText('Forecast updated successfully.')).toBeInTheDocument()
    })

    const patchCall = vi.mocked(globalThis.fetch).mock.calls[1] // index 0 = GET, 1 = PATCH
    const body = JSON.parse(patchCall[1]?.body as string)
    expect(body.claimText).toBe('Bitcoin will reach $200k')
    expect(body.detailsText).toBeUndefined()
    expect(body.resolutionRules).toBeUndefined()
  })

  it('includes isPublic in PATCH payload when toggled', async () => {
    mockFetchLoad()
    render(<EditForecastClient />)

    await waitFor(() => screen.getByText('Public'))

    // Toggle visibility
    fireEvent.click(screen.getByText('Public'))

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ...BASE_PREDICTION, isPublic: false }), { status: 200 })
    )

    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByText('Forecast updated successfully.')).toBeInTheDocument()
    })

    const patchCall = vi.mocked(globalThis.fetch).mock.calls[1]
    const body = JSON.parse(patchCall[1]?.body as string)
    expect(body.isPublic).toBe(false)
  })

  it('shows error message when PATCH fails', async () => {
    mockFetchLoad()
    render(<EditForecastClient />)

    await waitFor(() => screen.getByDisplayValue('Bitcoin will reach $100k'))

    fireEvent.change(screen.getByDisplayValue('Bitcoin will reach $100k'), {
      target: { value: 'Updated claim' },
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    )

    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument()
    })
  })

  it('shows "Saving..." while request is in flight', async () => {
    mockFetchLoad()
    render(<EditForecastClient />)

    await waitFor(() => screen.getByDisplayValue('Bitcoin will reach $100k'))

    fireEvent.change(screen.getByDisplayValue('Bitcoin will reach $100k'), {
      target: { value: 'Updated claim' },
    })

    let resolveRequest!: (r: Response) => void
    vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
      new Promise<Response>(resolve => { resolveRequest = resolve })
    )

    fireEvent.click(screen.getByText('Save Changes'))

    expect(screen.getByText('Saving...')).toBeInTheDocument()

    // Resolve and cleanup
    resolveRequest(
      new Response(JSON.stringify({ ...BASE_PREDICTION, claimText: 'Updated claim' }), {
        status: 200,
      })
    )
    await waitFor(() => expect(screen.queryByText('Saving...')).not.toBeInTheDocument())
  })

  it('navigates to forecast page when Cancel is clicked', async () => {
    mockFetchLoad()
    render(<EditForecastClient />)

    await waitFor(() => screen.getByText('Cancel'))

    fireEvent.click(screen.getByText('Cancel'))

    expect(mockPush).toHaveBeenCalledWith('/forecasts/test-slug')
  })

  it('falls back to id in cancel navigation when slug is absent', async () => {
    const noSlug = { ...BASE_PREDICTION, slug: undefined }
    mockFetchLoad(noSlug as any)
    render(<EditForecastClient />)

    await waitFor(() => screen.getByText('Cancel'))

    fireEvent.click(screen.getByText('Cancel'))

    expect(mockPush).toHaveBeenCalledWith('/forecasts/pred-1')
  })

  it('disables Save when claimText is empty', async () => {
    mockFetchLoad()
    render(<EditForecastClient />)

    await waitFor(() => screen.getByDisplayValue('Bitcoin will reach $100k'))

    fireEvent.change(screen.getByDisplayValue('Bitcoin will reach $100k'), {
      target: { value: '' },
    })

    expect(screen.getByText('Save Changes').closest('button')).toBeDisabled()
  })
})
