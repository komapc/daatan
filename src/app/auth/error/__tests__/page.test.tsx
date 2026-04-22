import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import AuthErrorClient from '../AuthErrorClient'
import { useSearchParams } from 'next/navigation'
import { vi, describe, it, expect, Mock } from 'vitest'
import messages from '../../../../../messages/en.json'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}))

const renderWithIntl = (ui: React.ReactElement) =>
  render(<NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>)

describe('AuthErrorPage', () => {
  it('renders default error message when no error param is provided', () => {
    (useSearchParams as Mock).mockReturnValue({
      get: () => null,
    })

    renderWithIntl(<AuthErrorClient />)

    expect(screen.getByText('Authentication Error')).toBeInTheDocument()
    expect(screen.getByText('An unexpected error occurred during authentication.')).toBeInTheDocument()
    expect(screen.getByText('Back to Sign In')).toBeInTheDocument()
  })

  it('renders specific message for Configuration error', () => {
    (useSearchParams as Mock).mockReturnValue({
      get: () => 'Configuration',
    })

    renderWithIntl(<AuthErrorClient />)

    expect(screen.getByText('There is a problem with the server configuration.')).toBeInTheDocument()
  })

  it('renders specific message for AccessDenied error', () => {
    (useSearchParams as Mock).mockReturnValue({
      get: () => 'AccessDenied',
    })

    renderWithIntl(<AuthErrorClient />)

    expect(screen.getByText('Access has been denied.')).toBeInTheDocument()
  })

  it('renders specific message for Verification error', () => {
    (useSearchParams as Mock).mockReturnValue({
      get: () => 'Verification',
    })

    renderWithIntl(<AuthErrorClient />)

    expect(screen.getByText('The verification link has expired or has already been used.')).toBeInTheDocument()
  })
})
