'use client'

import { useState } from 'react'

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

  const isActive = prediction.status === 'ACTIVE'
  const isResolved = commitment.cuReturned !== null && commitment.cuReturned !== undefined

  // Format outcome text
  const getOutcomeText = () => {
    if (commitment.option) {
      return commitment.option.text
    }
    if (commitment.binaryChoice !== undefined) {
      return commitment.binaryChoice ? 'Will Happen' : "Won't Happen"
    }
    return 'Unknown'
  }

  // Format timestamp
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleRemove = async () => {
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    setIsRemoving(true)
    try {
      const response = await fetch(`/api/predictions/${prediction.id}/commit`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove commitment')
      }

      if (onRemove) {
        onRemove()
      }
    } catch (error) {
      console.error('Error removing commitment:', error)
      alert('Failed to remove commitment. Please try again.')
    } finally {
      setIsRemoving(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Your Commitment</h3>
            <p className="mt-1 text-2xl font-bold text-gray-900">{commitment.cuCommitted} CU</p>
          </div>
          {isActive && (
            <div className="flex gap-2">
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="rounded-md bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100"
                >
                  Edit
                </button>
              )}
              {onRemove && (
                <button
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${
                    showConfirm
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-red-50 text-red-700 hover:bg-red-100'
                  } disabled:opacity-50`}
                >
                  {isRemoving ? 'Removing...' : showConfirm ? 'Confirm?' : 'Remove'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Outcome */}
        <div>
          <p className="text-sm text-gray-500">Predicted Outcome</p>
          <p className="mt-1 font-medium text-gray-900">{getOutcomeText()}</p>
        </div>

        {/* Timestamp */}
        <div>
          <p className="text-xs text-gray-400">Committed {formatDate(commitment.createdAt)}</p>
        </div>

        {/* Resolution Results */}
        {isResolved && (
          <div className="border-t border-gray-200 pt-3">
            <h4 className="mb-2 text-sm font-medium text-gray-700">Resolution Results</h4>
            <div className="grid grid-cols-2 gap-3">
              {/* CU Returned */}
              <div>
                <p className="text-xs text-gray-500">CU Returned</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {commitment.cuReturned ?? 0}
                </p>
              </div>

              {/* RS Change */}
              <div>
                <p className="text-xs text-gray-500">RS Change</p>
                <p
                  className={`mt-1 text-lg font-semibold ${
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

        {/* Cancel confirmation */}
        {showConfirm && (
          <button
            onClick={() => setShowConfirm(false)}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
