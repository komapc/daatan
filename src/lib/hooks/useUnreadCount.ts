'use client'

import { useState, useEffect, useCallback } from 'react'

export function useUnreadCount() {
  const [count, setCount] = useState(0)

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread-count')
      if (res.ok) {
        const data = await res.json()
        setCount(data.count)
      }
    } catch {
      // Silently fail — badge is non-critical
    }
  }, [])

  useEffect(() => {
    fetchCount()

    // Poll every 30s while tab is visible
    let interval: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (!interval) {
        interval = setInterval(fetchCount, 30_000)
      }
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        fetchCount()
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchCount])

  return { count, refetch: fetchCount }
}
