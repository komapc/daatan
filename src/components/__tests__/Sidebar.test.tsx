import { render, screen } from '@testing-library/react'
import Sidebar from '../Sidebar'
import { useSession } from 'next-auth/react'
import { vi, describe, it, expect } from 'vitest'

describe('Sidebar Component', () => {
  it('renders sign in button when unauthenticated', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    } as any)

    render(<Sidebar />)
    expect(screen.getByText(/Sign In/i)).toBeInTheDocument()
  })

  it('renders user info when authenticated', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { name: 'Test User', email: 'test@example.com', image: null },
        expires: 'any',
      },
      status: 'authenticated',
    } as any)

    render(<Sidebar />)
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('handles null session data gracefully (Build-time scenario)', () => {
    // This mocks the scenario that crashed the build: useSession returning undefined
    vi.mocked(useSession).mockReturnValue(undefined as any)

    // Component should not throw error even if session hook fails
    const { container } = render(<Sidebar />)
    expect(container).toBeInTheDocument()
  })
})
