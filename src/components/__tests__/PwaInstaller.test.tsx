import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

// vi.mock is hoisted above const declarations, so we need vi.hoisted to share
// the value between the mock factory and the test bodies.
const TEST_VERSION = vi.hoisted(() => 'test-1.0.0')
vi.mock('@/lib/version', () => ({ VERSION: TEST_VERSION }))

import PwaInstaller from '../PwaInstaller'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fake BeforeInstallPromptEvent with a spy on preventDefault. */
function makeInstallPromptEvent() {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: string; platform: string }>
    preventDefault: ReturnType<typeof vi.fn>
  }
  event.preventDefault = vi.fn() as any
  event.prompt = vi.fn().mockResolvedValue(undefined) as any
  event.userChoice = Promise.resolve({ outcome: 'dismissed', platform: '' })
  return event
}

/** Fire a beforeinstallprompt event and return the event object. */
function fireInstallPrompt() {
  const event = makeInstallPromptEvent()
  act(() => { window.dispatchEvent(event) })
  return event
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PwaInstaller — beforeinstallprompt handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Suppress service worker registration noise
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: () => Promise.resolve({} as ServiceWorkerRegistration) } as unknown as ServiceWorkerContainer,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('calls preventDefault on beforeinstallprompt when the banner is not dismissed', () => {
    render(<PwaInstaller />)
    const event = fireInstallPrompt()
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('does NOT call preventDefault when the user already dismissed for this version', () => {
    // Simulate prior dismissal stored in localStorage (must match the mocked VERSION)
    localStorage.setItem('pwa-install-dismissed-version', TEST_VERSION)

    render(<PwaInstaller />)
    const event = fireInstallPrompt()

    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('stops intercepting the event after the user clicks Dismiss', async () => {
    const { screen, fireEvent, waitFor } = await import('@testing-library/react')

    render(<PwaInstaller />)

    // Show the banner by firing the install prompt
    fireInstallPrompt()

    // Wait for the banner to appear, then click Dismiss
    await waitFor(() => screen.getByRole('button', { name: /close install prompt/i }))
    act(() => { fireEvent.click(screen.getByRole('button', { name: /close install prompt/i })) })

    // A subsequent beforeinstallprompt event should no longer be intercepted
    const secondEvent = makeInstallPromptEvent()
    act(() => { window.dispatchEvent(secondEvent) })

    expect(secondEvent.preventDefault).not.toHaveBeenCalled()
  })

  it('removes the event listener on unmount', () => {
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<PwaInstaller />)

    unmount()

    expect(removeListenerSpy).toHaveBeenCalledWith(
      'beforeinstallprompt',
      expect.any(Function),
    )
  })
})
