'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Loader2, BellOff, BellRing } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePushSubscription } from '@/lib/hooks/usePushSubscription'
import type { NotificationType } from '@prisma/client'

interface Preference {
  type: NotificationType
  inApp: boolean
  email: boolean
  browserPush: boolean
}

const TYPE_LABELS: Record<NotificationType, string> = {
  COMMITMENT_RESOLVED: 'Commitment resolved',
  COMMENT_ON_FORECAST: 'Comment on your forecast',
  REPLY_TO_COMMENT: 'Reply to your comment',
  NEW_COMMITMENT: 'New commitment on your forecast',
  MENTION: '@Mention',
  SYSTEM: 'System announcements',
}

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const { isSupported, permission, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushSubscription()
  const [pushWorking, setPushWorking] = useState(false)

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/preferences')
      if (res.ok) {
        const data = await res.json()
        setPreferences(data.preferences)
      } else {
        toast.error('Failed to load notification preferences')
      }
    } catch {
      toast.error('Failed to load notification preferences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  const togglePreference = async (type: NotificationType, channel: 'inApp' | 'browserPush') => {
    const pref = preferences.find((p) => p.type === type)
    if (!pref) return

    const newValue = !pref[channel]

    // Optimistic update
    setPreferences((prev) =>
      prev.map((p) => (p.type === type ? { ...p, [channel]: newValue } : p)),
    )

    setSaving(type)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          [channel]: newValue,
        }),
      })
      if (!res.ok) {
        // Revert on server error
        setPreferences((prev) =>
          prev.map((p) => (p.type === type ? { ...p, [channel]: !newValue } : p)),
        )
        toast.error('Failed to save preference')
      }
    } catch {
      // Revert on network error
      setPreferences((prev) =>
        prev.map((p) => (p.type === type ? { ...p, [channel]: !newValue } : p)),
      )
      toast.error('Failed to save preference')
    } finally {
      setSaving(null)
    }
  }

  const handleConnectPush = async () => {
    setPushWorking(true)
    const ok = await subscribe()
    setPushWorking(false)
    if (ok) toast.success('Push notifications enabled')
    else if (Notification.permission === 'denied') toast.error('Permission denied — unblock notifications in your browser settings')
    else toast.error('Could not enable push notifications')
  }

  const handleDisconnectPush = async () => {
    setPushWorking(true)
    await unsubscribe()
    setPushWorking(false)
    toast.success('Push notifications disabled')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      {/* Push notification status banner */}
      {isSupported && !pushLoading && (
        <div className={`flex items-center justify-between rounded-lg px-4 py-3 mb-4 text-sm ${
          isSubscribed
            ? 'bg-green-50 border border-green-200 text-green-800'
            : permission === 'denied'
            ? 'bg-red-50 border border-red-200 text-red-800'
            : 'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center gap-2">
            {isSubscribed ? (
              <BellRing className="w-4 h-4 shrink-0" />
            ) : (
              <BellOff className="w-4 h-4 shrink-0" />
            )}
            <span>
              {isSubscribed
                ? 'Browser push notifications are enabled on this device.'
                : permission === 'denied'
                ? 'Push notifications are blocked. Unblock them in your browser\u2019s site settings.'
                : 'Enable browser push notifications to get alerts even when the tab is closed.'}
            </span>
          </div>
          {isSubscribed ? (
            <button
              onClick={handleDisconnectPush}
              disabled={pushWorking}
              className="ml-4 shrink-0 text-xs font-medium underline hover:no-underline disabled:opacity-50"
            >
              {pushWorking ? 'Disabling\u2026' : 'Disable'}
            </button>
          ) : permission !== 'denied' ? (
            <button
              onClick={handleConnectPush}
              disabled={pushWorking}
              className="ml-4 shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pushWorking ? 'Enabling\u2026' : 'Enable'}
            </button>
          ) : null}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-3 pr-4 font-medium text-gray-700">Notification</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">In-app</th>
              <th className="text-center py-3 pl-4 font-medium text-gray-700">
                <div className="flex items-center justify-center gap-1">
                  <Bell className="w-4 h-4" />
                  Push
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {preferences.map((pref) => (
              <tr key={pref.type} className="border-b border-gray-50">
                <td className="py-3 pr-4 text-gray-900">
                  {TYPE_LABELS[pref.type]}
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => togglePreference(pref.type, 'inApp')}
                    disabled={saving === pref.type}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                      pref.inApp ? 'bg-blue-600' : 'bg-gray-200'
                    } disabled:opacity-50`}
                    role="switch"
                    aria-checked={pref.inApp}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        pref.inApp ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </td>
                <td className="py-3 pl-4 text-center">
                  {isSupported && isSubscribed ? (
                    <button
                      onClick={() => togglePreference(pref.type, 'browserPush')}
                      disabled={saving === pref.type}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                        pref.browserPush ? 'bg-blue-600' : 'bg-gray-200'
                      } disabled:opacity-50`}
                      role="switch"
                      aria-checked={pref.browserPush}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          pref.browserPush ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  ) : isSupported ? (
                    <button
                      onClick={handleConnectPush}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Connect
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">N/A</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
