import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

import PwaInstaller from '../PwaInstaller'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FakeInstallEvent = Event & { preventDefault: ReturnType<typeof vi.fn> }

function makeInstallPromptEvent(): FakeInstallEvent {
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'dismissed', platform: '' }),
  })
  const spy = vi.spyOn(event, 'preventDefault').mockImplementation(() => {})
  return Object.assign(event, { preventDefault: spy }) as unknown as FakeInstallEvent
}

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
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: () => Promise.resolve({} as ServiceWorkerRegistration) } as unknown as ServiceWorkerContainer,
      configurable: true,
      writable: true,
    })
    // Default: not running as standalone
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
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

  it('does NOT show banner when running in standalone (already installed) mode', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })

    render(<PwaInstaller />)
    const event = fireInstallPrompt()
    // isInstalled is set to true on mount so deferredPrompt is never set
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('does NOT call preventDefault when dismissed within the 90-day window', () => {
    const until = Date.now() + 60 * 24 * 60 * 60 * 1000 // 60 days from now
    localStorage.setItem('pwa-install-dismissed-until', String(until))

    render(<PwaInstaller />)
    const event = fireInstallPrompt()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('shows the prompt again after the dismiss window expires', () => {
    const until = Date.now() - 1000 // expired
    localStorage.setItem('pwa-install-dismissed-until', String(until))

    render(<PwaInstaller />)
    const event = fireInstallPrompt()
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('stops intercepting the event after the user clicks Dismiss', async () => {
    const { screen, fireEvent, waitFor } = await import('@testing-library/react')

    render(<PwaInstaller />)
    fireInstallPrompt()

    await waitFor(() => screen.getByRole('button', { name: /close install prompt/i }))
    act(() => { fireEvent.click(screen.getByRole('button', { name: /close install prompt/i })) })

    const secondEvent = makeInstallPromptEvent()
    act(() => { window.dispatchEvent(secondEvent) })
    expect(secondEvent.preventDefault).not.toHaveBeenCalled()
  })

  it('removes the event listener on unmount', () => {
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<PwaInstaller />)
    unmount()
    expect(removeListenerSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
  })
})
