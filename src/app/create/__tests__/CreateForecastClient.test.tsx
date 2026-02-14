import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CreateForecastClient from '../CreateForecastClient'

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock useSearchParams — default: no params. Override per-test via mockReturnValue.
const mockGet = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: mockGet }),
}))

// Lightweight stubs so we can assert which child component renders without
// pulling in heavy dependencies (API mocks, Prisma, etc.).
vi.mock('@/app/forecasts/express/ExpressForecastClient', () => ({
  __esModule: true,
  default: () => <div data-testid="express-client">ExpressForecastClient</div>,
}))

vi.mock('@/components/forecasts/ForecastWizard', () => ({
  ForecastWizard: ({ isExpressFlow }: { isExpressFlow: boolean }) => (
    <div data-testid="forecast-wizard" data-express={isExpressFlow}>
      ForecastWizard (express={String(isExpressFlow)})
    </div>
  ),
}))

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CreateForecastClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Default: no query params
    mockGet.mockReturnValue(null)
  })

  // ── Default mode (no query params) ──────────────────────────────────────

  it('renders the Express/Manual mode toggle by default', () => {
    render(<CreateForecastClient userId="user-1" />)

    expect(screen.getByText('Express')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('renders ExpressForecastClient when mode is express (default)', () => {
    render(<CreateForecastClient userId="user-1" />)

    expect(screen.getByTestId('express-client')).toBeInTheDocument()
    expect(screen.queryByTestId('forecast-wizard')).not.toBeInTheDocument()
  })

  it('switches to ForecastWizard (manual) when Manual button is clicked', () => {
    render(<CreateForecastClient userId="user-1" />)

    fireEvent.click(screen.getByText('Manual'))

    expect(screen.getByTestId('forecast-wizard')).toBeInTheDocument()
    expect(screen.queryByTestId('express-client')).not.toBeInTheDocument()

    // Wizard should NOT be in express flow mode
    expect(screen.getByTestId('forecast-wizard')).toHaveAttribute('data-express', 'false')
  })

  it('switches back to Express when Express button is clicked after Manual', () => {
    render(<CreateForecastClient userId="user-1" />)

    fireEvent.click(screen.getByText('Manual'))
    expect(screen.getByTestId('forecast-wizard')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Express'))
    expect(screen.getByTestId('express-client')).toBeInTheDocument()
  })

  // ── from=express query param (the bug scenario) ────────────────────────

  it('renders ForecastWizard with isExpressFlow=true when ?from=express', () => {
    mockGet.mockImplementation((key: string) => (key === 'from' ? 'express' : null))

    render(<CreateForecastClient userId="user-1" />)

    const wizard = screen.getByTestId('forecast-wizard')
    expect(wizard).toBeInTheDocument()
    expect(wizard).toHaveAttribute('data-express', 'true')
  })

  it('does NOT render mode toggle when ?from=express', () => {
    mockGet.mockImplementation((key: string) => (key === 'from' ? 'express' : null))

    render(<CreateForecastClient userId="user-1" />)

    expect(screen.queryByText('Express')).not.toBeInTheDocument()
    expect(screen.queryByText('Manual')).not.toBeInTheDocument()
  })

  it('does NOT render ExpressForecastClient input when ?from=express', () => {
    mockGet.mockImplementation((key: string) => (key === 'from' ? 'express' : null))

    render(<CreateForecastClient userId="user-1" />)

    expect(screen.queryByTestId('express-client')).not.toBeInTheDocument()
  })

  // ── Edge cases ──────────────────────────────────────────────────────────

  it('treats ?from=manual as default (no special handling)', () => {
    mockGet.mockImplementation((key: string) => (key === 'from' ? 'manual' : null))

    render(<CreateForecastClient userId="user-1" />)

    // Should show the normal mode toggle, not the wizard
    expect(screen.getByText('Express')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('treats ?from= (empty value) as default', () => {
    mockGet.mockImplementation((key: string) => (key === 'from' ? '' : null))

    render(<CreateForecastClient userId="user-1" />)

    expect(screen.getByText('Express')).toBeInTheDocument()
  })
})
