import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSession } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl'
import ForecastCard, { Prediction } from '../ForecastCard'
import messages from '../../../../messages/en.json'

const renderWithIntl = (ui: React.ReactElement) =>
  render(<NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>)

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

const basePrediction: Prediction = {
  id: 'pred-1',
  claimText: 'Test prediction',
  outcomeType: 'BINARY',
  status: 'ACTIVE',
  resolveByDatetime: new Date().toISOString(),
  author: {
    id: 'user-1',
    name: 'Author',
    username: 'author',
    image: null,
    rs: 100,
    role: 'USER',
  },
  newsAnchor: null,
  tags: [],
  _count: { commitments: 0 },
  totalCuCommitted: 0,
  userHasCommitted: false,
}

describe('ForecastCard voter pill', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useSession).mockReturnValue({ data: null, status: 'unauthenticated' } as any)
  })

  it('renders voter count when commitments > 0', () => {
    const prediction = { ...basePrediction, _count: { commitments: 5 }, totalCuCommitted: 250 }
    renderWithIntl(<ForecastCard prediction={prediction} />)

    // Voters tooltip embeds the count + CU; the pill itself shows the number
    // but "5" may also appear elsewhere (dates, RS), so we assert on the title.
    const pill = screen.getByTitle(/5 voters ·.*CU/i)
    expect(pill).toBeInTheDocument()
    expect(pill.textContent).toMatch(/5/)
  })

  it('hides voter pill when commitments = 0', () => {
    renderWithIntl(<ForecastCard prediction={basePrediction} />)
    expect(screen.queryByTitle(/voter/i)).toBeNull()
  })

  it('uses singular "voter" tooltip when exactly one commitment', () => {
    const prediction = { ...basePrediction, _count: { commitments: 1 }, totalCuCommitted: 10 }
    renderWithIntl(<ForecastCard prediction={prediction} />)
    // Singular voter key: "1 voter · {cu} CU staked"
    expect(screen.getByTitle(/1 voter ·/i)).toBeInTheDocument()
  })

  it('does NOT render the legacy "Confidence: N" text', () => {
    // Regression: we replaced the misleading "Confidence: {totalCuCommitted}" pill
    // with a voter count pill. The old copy should not leak back into the card.
    const prediction = { ...basePrediction, _count: { commitments: 3 }, totalCuCommitted: 133 }
    renderWithIntl(<ForecastCard prediction={prediction} />)
    expect(screen.queryByText(/Confidence:/i)).toBeNull()
  })
})

describe('ForecastCard AI estimate pill', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(useSession).mockReturnValue({ data: null, status: 'unauthenticated' } as any)
  })

  it('renders "AI: X±Y%" when aiCiLow/aiCiHigh are present', () => {
    const prediction = {
      ...basePrediction,
      confidence: 60,
      aiCiLow: 45,
      aiCiHigh: 75,
    }
    renderWithIntl(<ForecastCard prediction={prediction} />)
    // spread = round((75 - 45) / 2) = 15
    expect(screen.getByText('AI: 60±15%')).toBeInTheDocument()
  })

  it('renders "AI: X%" (no ±) when only confidence is present', () => {
    const prediction = {
      ...basePrediction,
      confidence: 72,
      aiCiLow: null,
      aiCiHigh: null,
    }
    renderWithIntl(<ForecastCard prediction={prediction} />)
    expect(screen.getByText('AI: 72%')).toBeInTheDocument()
  })

  it('hides AI pill when confidence is null', () => {
    renderWithIntl(<ForecastCard prediction={basePrediction} />)
    expect(screen.queryByText(/^AI: /)).toBeNull()
  })

  it('hides AI pill on non-ACTIVE forecasts', () => {
    const prediction = {
      ...basePrediction,
      status: 'RESOLVED_CORRECT',
      confidence: 60,
      aiCiLow: 45,
      aiCiHigh: 75,
    }
    renderWithIntl(<ForecastCard prediction={prediction} />)
    expect(screen.queryByText(/^AI: /)).toBeNull()
  })

  it('falls back to plain "AI: X%" when CI bounds are degenerate (high <= low)', () => {
    const prediction = {
      ...basePrediction,
      confidence: 55,
      aiCiLow: 55,
      aiCiHigh: 55,
    }
    renderWithIntl(<ForecastCard prediction={prediction} />)
    expect(screen.getByText('AI: 55%')).toBeInTheDocument()
  })
})
