import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { ModeratorResolutionSection } from '../ModeratorResolutionSection'

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

vi.mock('@/components/forecasts/ResolutionForm', () => ({
  ResolutionForm: ({ predictionId }: { predictionId: string }) => (
    <div data-testid="resolution-form">Resolve prediction {predictionId}</div>
  ),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

describe('ModeratorResolutionSection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns null when user is not resolver or admin', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: 'USER' }, expires: 'any' },
      status: 'authenticated',
    } as never)

    const { container } = render(
      <ModeratorResolutionSection predictionId="pred-1" predictionStatus="ACTIVE" outcomeType="BINARY" options={[]} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('returns null when user has no session', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    } as never)

    const { container } = render(
      <ModeratorResolutionSection predictionId="pred-1" predictionStatus="ACTIVE" outcomeType="BINARY" options={[]} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('returns null when prediction status is not ACTIVE or PENDING', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: 'RESOLVER' }, expires: 'any' },
      status: 'authenticated',
    } as never)

    const { container } = render(
      <ModeratorResolutionSection predictionId="pred-1" predictionStatus="RESOLVED_CORRECT" outcomeType="BINARY" options={[]} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('shows toggle but hides ResolutionForm by default for RESOLVER', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: 'RESOLVER' }, expires: 'any' },
      status: 'authenticated',
    } as never)

    render(
      <ModeratorResolutionSection predictionId="pred-1" predictionStatus="ACTIVE" outcomeType="BINARY" options={[]} />
    )

    expect(screen.getByText('resolverActions')).toBeInTheDocument()
    expect(screen.queryByTestId('resolution-form')).not.toBeInTheDocument()
  })

  it('reveals ResolutionForm after clicking the toggle (RESOLVER)', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: 'RESOLVER' }, expires: 'any' },
      status: 'authenticated',
    } as never)

    render(
      <ModeratorResolutionSection predictionId="pred-1" predictionStatus="ACTIVE" outcomeType="BINARY" options={[]} />
    )

    fireEvent.click(screen.getByText('resolverActions'))

    expect(screen.getByTestId('resolution-form')).toBeInTheDocument()
    expect(screen.getByText(/Resolve prediction pred-1/)).toBeInTheDocument()
  })

  it('reveals ResolutionForm after clicking the toggle (ADMIN)', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: 'ADMIN' }, expires: 'any' },
      status: 'authenticated',
    } as never)

    render(
      <ModeratorResolutionSection predictionId="pred-2" predictionStatus="ACTIVE" outcomeType="BINARY" options={[]} />
    )

    fireEvent.click(screen.getByText('resolverActions'))

    expect(screen.getByTestId('resolution-form')).toBeInTheDocument()
  })

  it('reveals ResolutionForm for RESOLVER on PENDING prediction', () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: 'RESOLVER' }, expires: 'any' },
      status: 'authenticated',
    } as never)

    render(
      <ModeratorResolutionSection predictionId="pred-3" predictionStatus="PENDING" outcomeType="BINARY" options={[]} />
    )

    fireEvent.click(screen.getByText('resolverActions'))

    expect(screen.getByTestId('resolution-form')).toBeInTheDocument()
  })
})
