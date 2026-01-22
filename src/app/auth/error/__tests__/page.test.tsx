import { render, screen } from '@testing-library/react'
import AuthErrorPage from '../page'
import { useSearchParams } from 'next/navigation'
import { vi, describe, it, expect, Mock } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}))

describe('AuthErrorPage', () => {
  it('renders default error message when no error param is provided', () => {
    (useSearchParams as Mock).mockReturnValue({
      get: () => null,
    })

    render(<AuthErrorPage />)

    expect(screen.getByText('Authentication Error')).toBeInTheDocument()
    expect(screen.getByText('An unexpected error occurred during authentication.')).toBeInTheDocument()
    expect(screen.getByText('Back to Sign In')).toBeInTheDocument()
  })

  it('renders specific message for Configuration error', () => {
    (useSearchParams as Mock).mockReturnValue({
      get: () => 'Configuration',
    })

    render(<AuthErrorPage />)

    expect(screen.getByText('There is a problem with the server configuration.')).toBeInTheDocument()
  })

  it('renders specific message for AccessDenied error', () => {
    (useSearchParams as Mock).mockReturnValue({
      get: () => 'AccessDenied',
    })

    render(<AuthErrorPage />)

    expect(screen.getByText('Access has been denied.')).toBeInTheDocument()
  })

  it('renders specific message for Verification error', () => {
    (useSearchParams as Mock).mockReturnValue({
      get: () => 'Verification',
    })

    render(<AuthErrorPage />)

    expect(screen.getByText('The verification link has expired or has already been used.')).toBeInTheDocument()
  })
})
