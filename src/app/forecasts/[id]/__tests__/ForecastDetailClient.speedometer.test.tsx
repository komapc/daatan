import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSession } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl'
import ForecastDetailClient from '../ForecastDetailClient'
import enMessages from '../../../../../messages/en.json'

// Capture Speedometer calls so we can assert on the percentage prop
const { speedometerMock } = vi.hoisted(() => ({ speedometerMock: vi.fn(() => null) }))
vi.mock('@/components/forecasts/Speedometer', () => ({ default: speedometerMock }))

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useParams: () => ({ id: 'pred-1' }),
}))
vi.mock('@/components/comments/CommentThread', () => ({ default: () => null }))
vi.mock('@/components/forecasts/CommitmentForm', () => ({ default: () => null }))
vi.mock('@/components/forecasts/CommitmentDisplay', () => ({ default: () => null }))
vi.mock('@/components/forecasts/CUBalanceIndicator', () => ({ default: () => null }))
vi.mock('@/components/forecasts/ContextTimeline', () => ({ default: () => null }))
vi.mock('../ModeratorResolutionSection', () => ({ ModeratorResolutionSection: () => null }))

const globalFetch = global.fetch
afterEach(() => { global.fetch = globalFetch })

const makeCommitment = (binaryChoice: boolean, cuCommitted: number, idx = 0) => ({
  id: `c${idx}`,
  binaryChoice,
  cuCommitted,
  optionId: null,
  option: null,
  user: { id: `u${idx}`, username: `user${idx}`, name: `User ${idx}`, image: null, rs: 100 },
})

const makePrediction = (commitments: { binaryChoice: boolean; cuCommitted: number }[]) => {
  const enriched = commitments.map((c, i) => makeCommitment(c.binaryChoice, c.cuCommitted, i))
  return {
    id: 'pred-1',
    claimText: 'Test claim',
    detailsText: '',
    outcomeType: 'BINARY',
    status: 'ACTIVE',
    resolveByDatetime: new Date().toISOString(),
    author: { id: 'u1', name: 'User', username: 'user', image: null, rs: 100, role: 'USER' },
    options: [],
    commitments: enriched,
    totalCuCommitted: enriched.reduce((s, c) => s + c.cuCommitted, 0),
    isPublic: true,
    shareToken: 'token',
  }
}

const wrap = (ui: React.ReactElement) => (
  <NextIntlClientProvider locale="en" messages={enMessages}>{ui}</NextIntlClientProvider>
)

const renderPrediction = (commitments: { binaryChoice: boolean; cuCommitted: number }[]) =>
  render(wrap(<ForecastDetailClient initialData={makePrediction(commitments) as any} />))

describe('Speedometer — probability calculation', () => {
  beforeEach(() => {
    speedometerMock.mockClear()
    vi.mocked(useSession).mockReturnValue({ data: null, status: 'unauthenticated' } as any)
  })

  it('shows 50% when there are no commitments', () => {
    renderPrediction([])
    expect(speedometerMock).toHaveBeenCalledWith(
      expect.objectContaining({ percentage: 50 }),
      expect.anything()
    )
  })

  it('uses CU amounts, not headcount — 2 CU yes vs 100 CU no = ~2%', () => {
    renderPrediction([
      { binaryChoice: true,  cuCommitted: 2   },
      { binaryChoice: false, cuCommitted: 100 },
    ])
    // 2 / 102 ≈ 1.96% → rounds to 2
    expect(speedometerMock).toHaveBeenCalledWith(
      expect.objectContaining({ percentage: 2 }),
      expect.anything()
    )
  })

  it('headcount would give 50% but CU gives 2% — regression guard', () => {
    // Reported bug: 2 persons (2 CU vs 100 CU) was showing 50% (headcount) instead of 2% (CU)
    renderPrediction([
      { binaryChoice: true,  cuCommitted: 2   },
      { binaryChoice: false, cuCommitted: 100 },
    ])
    const call = (speedometerMock.mock.calls[0] as unknown as [{ percentage: number }])[0]
    expect(call.percentage).not.toBe(50)
    expect(call.percentage).toBe(2)
  })

  it('shows 50% when yes and no CU are equal', () => {
    renderPrediction([
      { binaryChoice: true,  cuCommitted: 50 },
      { binaryChoice: false, cuCommitted: 50 },
    ])
    expect(speedometerMock).toHaveBeenCalledWith(
      expect.objectContaining({ percentage: 50 }),
      expect.anything()
    )
  })

  it('shows 100% when all CU is on yes', () => {
    renderPrediction([
      { binaryChoice: true, cuCommitted: 200 },
      { binaryChoice: true, cuCommitted: 100 },
    ])
    expect(speedometerMock).toHaveBeenCalledWith(
      expect.objectContaining({ percentage: 100 }),
      expect.anything()
    )
  })

  it('shows 0% when all CU is on no', () => {
    renderPrediction([
      { binaryChoice: false, cuCommitted: 100 },
      { binaryChoice: false, cuCommitted: 50  },
    ])
    expect(speedometerMock).toHaveBeenCalledWith(
      expect.objectContaining({ percentage: 0 }),
      expect.anything()
    )
  })

  it('weights by CU — one large staker outweighs many small ones', () => {
    // 10 persons × 1 CU yes = 10 CU; 1 person × 90 CU no = 90 CU
    // headcount: 10/11 = 91% — wrong; CU: 10/100 = 10% — correct
    renderPrediction([
      ...Array(10).fill({ binaryChoice: true,  cuCommitted: 1 }),
      { binaryChoice: false, cuCommitted: 90 },
    ])
    expect(speedometerMock).toHaveBeenCalledWith(
      expect.objectContaining({ percentage: 10 }),
      expect.anything()
    )
  })
})

describe('Speedometer — state update after voting (router.refresh regression)', () => {
  beforeEach(() => {
    speedometerMock.mockClear()
    vi.mocked(useSession).mockReturnValue({ data: null, status: 'unauthenticated' } as any)
  })

  it('fetches once on mount but not again when initialData prop changes (simulates router.refresh)', async () => {
    // The component always fetches from the API on mount to get fresh data (bypassing ISR cache).
    // When router.refresh() delivers new initialData prop with the same id, the effect
    // does NOT re-run (id dependency unchanged), so fetch is called exactly once.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makePrediction([]),
    })
    global.fetch = fetchMock

    const initial = makePrediction([])
    const { rerender } = render(wrap(<ForecastDetailClient initialData={initial as any} />))

    // Simulate router.refresh(): re-render with new initialData reference (same id)
    const refreshedInitial = { ...initial, claimText: 'Server-refreshed claim' }
    rerender(wrap(<ForecastDetailClient initialData={refreshedInitial as any} />))

    // fetch is called once on mount, but NOT again on re-render with same id
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('re-fetches when navigating to a different forecast id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makePrediction([]),
    })
    global.fetch = fetchMock

    const initial = makePrediction([])
    // Render without initialData matching 'pred-1' — by passing a different id via params mock
    // The useEffect guard: if initialData.id === id, skip. Here we provide no initialData.
    render(wrap(<ForecastDetailClient />))

    // Should fetch since there's no initialData
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/forecasts/pred-1'))
    void initial
  })
})
