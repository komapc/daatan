'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { VERSION } from '@/lib/version'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'pwa-install-dismissed-version'

const PwaInstaller = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  // On mount, check if user already dismissed for this version
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const dismissedVersion = localStorage.getItem(DISMISS_KEY)
      if (dismissedVersion === VERSION) {
        setIsDismissed(true)
      }
    } catch {
      // localStorage unavailable — leave as not dismissed
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Service worker registration failed', error)
      }
    }

    register()
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return
    }

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, VERSION)
    } catch {
      // localStorage unavailable — dismiss for this session only
    }
  }

  if (isInstalled || !deferredPrompt || isDismissed) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-300">
          Install DAATAN
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close install prompt"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-200 line-clamp-2">
          Install this app for quicker access and a better full-screen experience.
        </p>
        <button
          type="button"
          className="shrink-0 rounded-md bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          onClick={handleInstallClick}
        >
          Install
        </button>
      </div>
    </div>
  )
}

export default PwaInstaller
