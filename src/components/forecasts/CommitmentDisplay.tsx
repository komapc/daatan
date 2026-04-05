'use client'

import { useState } from 'react'
import { createClientLogger } from '@/lib/client-logger'
import { Pencil, Trash2, Loader2 } from 'lucide-react'

const log = createClientLogger('CommitmentDisplay')

interface Commitment {
  id: string
  cuCommitted: number   // stores confidence value (-100..100)
  binaryChoice?: boolean
  rsSnapshot: number
  createdAt: string
  rsChange?: number | null
  brierScore?: number | null
  option?: {
    id: string
    text: string
  } | null
}

interface Prediction {
  id: string
  status: string
  outcomeType: string
}

interface CommitmentDisplayProps {
  commitment: Commitment
  prediction: Prediction
  onEdit?: () => void
  onRemove?: () => void
}

export default function CommitmentDisplay({
  commitment,
  prediction,
  onEdit,
  onRemove,
}: CommitmentDisplayProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isActive = prediction.status === 'ACTIVE'
  const isResolved = commitment.rsChange !== null && commitment.rsChange !== undefined

  const confidence = commitment.cuCommitted
  const probability = commitment.option
    ? Math.round(confidence)       // MULTIPLE_CHOICE: 0–100
    : Math.round((confidence + 100) / 2)  // BINARY: map -100..100 → 0..100%

  const getOutcomeText = () => {
    if (commitment.option) return commitment.option.text
    if (commitment.binaryChoice !== undefined) {
      return commitment.binaryChoice ? 'Will Happen' : "Won't Happen"
    }
    return 'Unknown'
  }

  const getOutcomeColor = () => {
    if (commitment.binaryChoice === true) return 'text-teal bg-teal/10 border-green-200'
    if (commitment.binaryChoice === false) return 'text-red-400 bg-red-900/20 border-red-800/50'
    return 'text-cobalt-light bg-cobalt/10 border-cobalt/30'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  const handleRemoveClick = () => {
    setIsConfirming(true)
  }

  const confirmRemove = async () => {
    setIsRemoving(true)
    setError(null)
    try {
      const response = await fetch(`/api/forecasts/${prediction.id}/commit`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to remove commitment')
      if (onRemove) onRemove()
    } catch (err) {
      log.error({ err }, 'Error removing commitment')
      setError('Failed to remove commitment. Please try again.')
    } finally {
      setIsRemoving(false)
      setIsConfirming(false)
    }
  }

  return (
    <div className="rounded-xl border border-navy-600 bg-navy-700 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

      <div className="p-5">
        {/* Top row: confidence + actions */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Your Confidence
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold ${confidence > 0 ? 'text-teal' : confidence < 0 ? 'text-red-400' : 'text-white'}`}>
                {confidence > 0 ? '+' : ''}{confidence}
              </span>
              <span className="text-sm text-gray-400">/ {probability}% implied</span>
            </div>
          </div>

          {isActive && (
            <div className="flex items-center gap-1">
              {onEdit && !isConfirming && (
                <button onClick={onEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-navy-700 transition-colors"
                  aria-label="Edit commitment">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
              )}
              {onRemove && !isConfirming && (
                <button onClick={handleRemoveClick} disabled={isRemoving}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  aria-label="Remove commitment">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-900/20 border border-red-800/50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        {/* Details row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getOutcomeColor()}`}>
            {getOutcomeText()}
          </span>
          <span className="text-xs text-gray-400">Committed {formatDate(commitment.createdAt)}</span>
        </div>

        {/* Confirm removal */}
        {isConfirming && (
          <div className="mt-4 rounded-lg border border-red-800/50 bg-red-900/10 p-4">
            <p className="text-sm text-red-300 mb-3">Remove your commitment? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={confirmRemove} disabled={isRemoving}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {isRemoving ? 'Removing...' : 'Confirm remove'}
              </button>
              <button onClick={() => setIsConfirming(false)} disabled={isRemoving}
                className="flex-1 rounded-lg border border-gray-300 bg-navy-700 px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-navy-800 transition-colors disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Resolution Results */}
        {isResolved && (
          <div className="mt-4 rounded-lg bg-navy-800 border border-navy-600 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">Resolution Results</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">ΔRS (Brier)</p>
                <p className={`mt-0.5 text-xl font-bold ${
                  (commitment.rsChange ?? 0) > 0 ? 'text-green-600' : (commitment.rsChange ?? 0) < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {(commitment.rsChange ?? 0) > 0 ? '+' : ''}{commitment.rsChange ?? 0}
                </p>
              </div>
              {commitment.brierScore != null && (
                <div>
                  <p className="text-xs text-gray-500">Brier Score</p>
                  <p className="mt-0.5 text-xl font-bold text-white">
                    {commitment.brierScore.toFixed(3)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
