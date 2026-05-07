'use client'
import { useState } from 'react'
import { Users, Trash2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { UserLink } from '@/components/UserLink'
import type { Prediction } from './types'

interface Props {
  prediction: Prediction
  currentUserId?: string
  onRemove?: () => void
}

function toPct(cuCommitted: number): number {
  return Math.round((cuCommitted + 100) / 2)
}

export function CommitmentsHistory({ prediction, currentUserId, onRemove }: Props) {
  const t = useTranslations('forecast')
  const [isRemoving, setIsRemoving] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  if (prediction.commitments.length === 0) return null

  const sorted = [...prediction.commitments].sort((a, b) => {
    if (a.user.id === currentUserId) return -1
    if (b.user.id === currentUserId) return 1
    return 0
  })

  const confirmRemove = async () => {
    setIsRemoving(true)
    setRemoveError(null)
    try {
      const response = await fetch(`/api/forecasts/${prediction.id}/commit`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to remove commitment')
      onRemove?.()
    } catch {
      setRemoveError('Failed to remove. Please try again.')
    } finally {
      setIsRemoving(false)
      setIsConfirming(false)
    }
  }

  return (
    <div className="mt-12">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Users className="w-5 h-5" />
        {t('forecastsHistory')}
      </h2>
      <div className="border border-navy-600 rounded-lg divide-y divide-navy-600">
        {sorted.map((commitment) => {
          const isCurrentUser = commitment.user.id === currentUserId
          const isBinary = prediction.outcomeType === 'BINARY'
          const pct = isBinary
            ? toPct(commitment.cuCommitted)
            : Math.round(commitment.cuCommitted)
          const direction = isBinary
            ? (commitment.binaryChoice ? t('willHappen') : t('wontHappen'))
            : (commitment.option?.text ?? '')
          const dirColor = commitment.binaryChoice === true
            ? 'text-teal-400'
            : commitment.binaryChoice === false
              ? 'text-red-400'
              : 'text-cobalt-light'
          const rsChange = commitment.rsChange
          const isResolved = rsChange !== null && rsChange !== undefined

          return (
            <div key={commitment.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <UserLink
                  userId={commitment.user.id}
                  username={commitment.user.username}
                  name={commitment.user.name}
                  image={commitment.user.image}
                  showAvatar={true}
                  avatarSize={32}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{commitment.user.name}</span>
                    {isCurrentUser && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/50">
                        {t('youBadge')}
                      </span>
                    )}
                  </div>
                </UserLink>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${dirColor}`}>{direction}</span>
                    <span className="text-sm text-gray-400 ml-1">· {pct}%</span>
                  </div>
                  {isCurrentUser && prediction.status === 'ACTIVE' && onRemove && !isConfirming && (
                    <button
                      onClick={() => setIsConfirming(true)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-900/20 transition-colors"
                      aria-label="Remove vote"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {isResolved && (
                <div className="mt-1.5 ml-10">
                  <span className={`text-xs font-medium ${rsChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {rsChange >= 0 ? '+' : ''}{rsChange} RS
                  </span>
                </div>
              )}

              {isCurrentUser && isConfirming && (
                <div className="mt-3 rounded-lg border border-red-800/50 bg-red-900/10 p-3">
                  <p className="text-sm text-red-300 mb-2">Remove your vote? This cannot be undone.</p>
                  {removeError && <p className="text-xs text-red-400 mb-2">{removeError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={confirmRemove}
                      disabled={isRemoving}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {isRemoving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {isRemoving ? 'Removing...' : 'Confirm remove'}
                    </button>
                    <button
                      onClick={() => setIsConfirming(false)}
                      disabled={isRemoving}
                      className="flex-1 rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-navy-800 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
