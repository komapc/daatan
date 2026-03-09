import { render, screen } from '@testing-library/react'
import { UserProfileView } from '../UserProfileView'
import { describe, it, expect, vi } from 'vitest'

// Mock next-intl
vi.mock('next-intl/server', () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}))

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

// Mock RoleBadge
vi.mock('@/components/RoleBadge', () => ({
  RoleBadge: ({ role }: any) => <span data-testid="role-badge">{role}</span>,
}))

// Mock ForecastCard
vi.mock('@/components/forecasts/ForecastCard', () => ({
  default: ({ prediction }: any) => (
    <div data-testid="forecast-card">{prediction.claimText}</div>
  ),
}))

// Mock EmptyState
vi.mock('@/components/ui/EmptyState', () => ({
  default: ({ description }: any) => <div>{description}</div>,
}))

describe('UserProfileView Component', () => {
  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    username: 'testuser',
    image: 'https://example.com/image.jpg',
    role: 'USER',
    rs: 150.5,
    cuAvailable: 500,
    createdAt: new Date('2025-01-01').toISOString(),
    _count: { predictions: 10, commitments: 5 }
  }

  const mockCommitments = [
    {
      id: 'c1',
      cuCommitted: 100,
      prediction: { id: 'p1', claimText: 'Forecast 1' }
    }
  ]

  const mockPredictions = [
    { id: 'p2', claimText: 'Forecast 2' }
  ]

  it('renders user information correctly', async () => {
    const component = await UserProfileView({
      user: mockUser,
      commitments: [],
      myPredictions: [],
      avgBrierScore: 0.123,
      brierCount: 2,
      isOwnProfile: true
    })
    
    render(component)

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('@testuser')).toBeInTheDocument()
    expect(screen.getByText('150.5')).toBeInTheDocument() // RS
    expect(screen.getByText('500')).toBeInTheDocument() // CU
    expect(screen.getByText('0.123')).toBeInTheDocument() // Brier
  })

  it('renders "Edit profile" link only for own profile', async () => {
    const ownProfile = await UserProfileView({
      user: mockUser,
      commitments: [],
      myPredictions: [],
      avgBrierScore: null,
      brierCount: 0,
      isOwnProfile: true
    })
    
    const { rerender } = render(ownProfile)
    // Find the link by its href
    const editLink = screen.getAllByRole('link').find(l => l.getAttribute('href') === '/profile/edit')
    expect(editLink).toBeInTheDocument()

    const publicProfile = await UserProfileView({
      user: mockUser,
      commitments: [],
      myPredictions: [],
      avgBrierScore: null,
      brierCount: 0,
      isOwnProfile: false
    })
    
    rerender(publicProfile)
    const publicEditLink = screen.queryAllByRole('link').find(l => l.getAttribute('href') === '/profile/edit')
    expect(publicEditLink).toBeUndefined()
  })

  it('renders stakes and predictions', async () => {
    const component = await UserProfileView({
      user: mockUser,
      commitments: mockCommitments,
      myPredictions: mockPredictions,
      avgBrierScore: null,
      brierCount: 0,
      isOwnProfile: false
    })
    
    render(component)

    expect(screen.getByText('Forecast 1')).toBeInTheDocument()
    expect(screen.getByText('Forecast 2')).toBeInTheDocument()
    expect(screen.getByText('staked 100 CU')).toBeInTheDocument()
  })
})
