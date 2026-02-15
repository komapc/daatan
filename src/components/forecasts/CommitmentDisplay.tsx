'use client'

import { useState } from 'react'
import { createClientLogger } from '@/lib/client-logger'
import { Pencil, Trash2, Loader2 } from 'lucide-react'

const log = createClientLogger('CommitmentDisplay')

interface Commitment {
  id: string
  cuCommitted: number
  binaryChoice?: boolean
  rsSnapshot: number
  createdAt: string
  cuReturned?: number | null
  rsChange?: number | null
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
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isActive = prediction.status === 'ACTIVE'
  const isResolved = commitment.cuReturned !== null && commitment.cuReturned !== undefined

  const getOutcomeText = () => {
    if (commitment.option) return commitment.option.text
    if (commitment.binaryChoice !== undefined) {
      return commitment.binaryChoice ? 'Will Happen' : "Won't Happen"
    }
    return 'Unknown'
  }

  const getOutcomeColor = () => {
    if (commitment.binaryChoice === true) return 'text-green-700 bg-green-50 border-green-200'
    if (commitment.binaryChoice === false) return 'text-red-700 bg-red-50 border-red-200'
    return 'text-blue-700 bg-blue-50 border-blue-200'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleRemove = async () => {
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    setIsRemoving(true)
    setError(null)
    try {
      const response = await fetch(`/api/forecasts/${prediction.id}/commit`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove commitment')
      }

      if (onRemove) {
        onRemove()
      }
    } catch (error) {
      log.error({ err: error }, 'Error removing commitment')
      setError('Failed to remove commitment. Please try again.')
    } finally {
      setIsRemoving(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Accent bar */}
      <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

      <div className="p-5">
        {/* Top row: CU amount + actions */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Your Commitment
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-gray-900">
                {commitment.cuCommitted}
              </span>
              <span className="text-sm font-semibold text-gray-400">CU</span>
            </div>
          </div>

          {isActive && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Edit commitment"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
              {onRemove && (
                <button
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    showConfirm
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'text-red-600 hover:bg-red-50'
                  }`}
                  aria-label={showConfirm ? 'Confirm removal' : 'Remove commitment'}
                >
                  {isRemoving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  {isRemoving ? 'Removing...' : showConfirm ? 'Confirm?' : 'Remove'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Details row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getOutcomeColor()}`}
          >
            {getOutcomeText()}
          </span>
          <span className="text-xs text-gray-400">
            Committed {formatDate(commitment.createdAt)}
          </span>
        </div>

        {/* Resolution Results */}
        {isResolved && (
          <div className="mt-4 rounded-lg bg-gray-50 border border-gray-100 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
              Resolution Results
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">CU Returned</p>
                <p className="mt-0.5 text-xl font-bold text-gray-900">
                  {commitment.cuReturned ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">RS Change</p>
                <p
                  className={`mt-0.5 text-xl font-bold ${
                    (commitment.rsChange ?? 0) > 0
                      ? 'text-green-600'
                      : (commitment.rsChange ?? 0) < 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                  }`}
                >
                  {(commitment.rsChange ?? 0) > 0 ? '+' : ''}
                  {commitment.rsChange?.toFixed(1) ?? '0.0'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cancel confirmation hint */}
        {showConfirm && (
          <button
            onClick={() => setShowConfirm(false)}
            className="mt-2 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
