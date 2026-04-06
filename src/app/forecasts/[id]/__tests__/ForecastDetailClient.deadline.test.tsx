import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSession } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl'
import ForecastDetailClient from '../ForecastDetailClient'
import enMessages from '../../../../../messages/en.json'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useParams: () => ({ id: 'pred-1' }),
}))
vi.mock('@/components/forecasts/Speedometer', () => ({ default: () => null }))
vi.mock('@/components/comments/CommentThread', () => ({ default: () => null }))
vi.mock('@/components/forecasts/CommitmentForm', () => ({ default: () => null }))
vi.mock('@/components/forecasts/CommitmentDisplay', () => ({ default: () => null }))
vi.mock('@/components/forecasts/CUBalanceIndicator', () => ({ default: () => null }))
vi.mock('@/components/forecasts/ContextTimeline', () => ({ default: () => null }))
vi.mock('../ModeratorResolutionSection', () => ({ ModeratorResolutionSection: () => null }))

const RESOLVE_BY = '2026-04-16T23:59:59.000Z'

const makePrediction = () => ({
  id: 'pred-1',
  claimText: 'Test claim',
  detailsText: '',
  outcomeType: 'BINARY',
  status: 'ACTIVE',
  resolveByDatetime: RESOLVE_BY,
  author: { id: 'u1', name: 'User', username: 'user', image: null, rs: 100, role: 'USER' },
  options: [],
  commitments: [],
  totalCuCommitted: 0,
  isPublic: true,
  shareToken: 'token',
})

const wrap = (ui: React.ReactElement) => (
  <NextIntlClientProvider locale="en" messages={enMessages}>{ui}</NextIntlClientProvider>
)

describe('ForecastDetailClient — Deadline panel', () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({ data: null, status: 'unauthenticated' } as any)
  })

  it('renders the Deadline label', async () => {
    render(wrap(<ForecastDetailClient initialData={makePrediction() as any} />))
    // The translation key is 'deadline'
    const labels = await screen.findAllByText(/deadline/i)
    expect(labels.length).toBeGreaterThan(0)
  })

  it('shows a non-empty formatted date after mount (isMounted guard)', async () => {
    render(wrap(<ForecastDetailClient initialData={makePrediction() as any} />))

    // Wait for isMounted useEffect to set state and the date to appear
    await waitFor(() => {
      // The year 2026 must appear somewhere in the deadline panel
      const matches = screen.getAllByText(/2026/)
      expect(matches.length).toBeGreaterThan(0)
    })
  })

  it('deadline text includes a timezone abbreviation (GMT or UTC or named zone)', async () => {
    render(wrap(<ForecastDetailClient initialData={makePrediction() as any} />))

    await waitFor(() => {
      // toLocaleString with timeZoneName: 'short' always appends a tz token
      // In CI (UTC) this is "UTC"; in local envs it may be "GMT+N" or "EET" etc.
      const fullText = document.body.textContent ?? ''
      expect(fullText).toMatch(/UTC|GMT|[A-Z]{2,5}T/)
    })
  })
})
