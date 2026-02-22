'use client'

import { useState } from 'react'

interface PredictionOption {
  id: string
  text: string
}

interface Prediction {
  id: string
  outcomeType: string
  options?: PredictionOption[]
  lockedAt?: string | null
}

interface ExistingCommitment {
  id: string
  cuCommitted: number
  binaryChoice?: boolean
  optionId?: string
}

interface Commitment {
  id: string
  cuCommitted: number
  binaryChoice?: boolean
  optionId?: string
  predictionId: string
  userId: string
}

interface CommitmentFormProps {
  prediction: Prediction
  existingCommitment?: ExistingCommitment
  userCuAvailable: number
  onSuccess: (commitment: Commitment) => void
  onCancel?: () => void
}

export default function CommitmentForm({
  prediction,
  existingCommitment,
  userCuAvailable,
  onSuccess,
  onCancel,
}: CommitmentFormProps) {
  const isUpdate = !!existingCommitment
  const isLocked = !!prediction.lockedAt

  // State
  const [cuAmount, setCuAmount] = useState<number | ''>(existingCommitment?.cuCommitted || 10)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // After lock: cannot increase CU; cap at current committed amount
  const maxCu = isUpdate
    ? isLocked
      ? existingCommitment.cuCommitted // locked: no increases allowed
      : userCuAvailable + existingCommitment.cuCommitted
    : userCuAvailable

  const submitOutcome = async (outcomeValue: string | boolean) => {
    setError(null)
    const numericCu = Number(cuAmount)

    if (!numericCu || numericCu < 1 || numericCu > maxCu) {
      setError(`Please enter a valid amount (1 - ${maxCu} CU)`)
      return
    }

    setIsSubmitting(true)

    try {
      const endpoint = `/api/forecasts/${prediction.id}/commit`
      const method = isUpdate ? 'PATCH' : 'POST'

      const body: Record<string, unknown> = {
        cuCommitted: numericCu,
      }

      if (prediction.outcomeType === 'BINARY') {
        body.binaryChoice = outcomeValue as boolean
      } else {
        body.optionId = outcomeValue as string
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save commitment')
      }

      const result = await response.json()
      window.dispatchEvent(new CustomEvent('daatan:first-action'))
      onSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsSubmitting(false)
    }
  }

  // Helper to determine if a specific outcome outcome is the currently committed one
  const isCurrentOutcome = (val: string | boolean) => {
    if (!existingCommitment) return false
    if (prediction.outcomeType === 'BINARY') return existingCommitment.binaryChoice === val
    return existingCommitment.optionId === val
  }

  return (
    <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          {isUpdate ? 'Update your commitment' : 'Make your commitment'}
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 sm:items-stretch">
        {/* Simplified CU Input */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-300 shadow-sm w-fit self-start sm:self-auto">
          <input
            type="number"
            min="1"
            max={maxCu}
            value={cuAmount}
            onChange={(e) => setCuAmount(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-16 sm:w-20 text-lg font-bold text-gray-900 outline-none bg-transparent"
          />
          <span className="text-gray-500 font-medium">CU</span>
        </div>

        {/* Action Buttons */}
        <div className="flex-1 space-y-2">
          {prediction.outcomeType === 'BINARY' ? (
            <div className="flex gap-2 h-full">
              <button
                type="button"
                onClick={() => submitOutcome(true)}
                disabled={isSubmitting || (isUpdate && isLocked && !isCurrentOutcome(true))}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all shadow-sm ${isCurrentOutcome(true)
                    ? 'bg-green-600 text-white border-green-700 hover:bg-green-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-green-50 hover:border-green-400 hover:text-green-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting ? '...' : isUpdate ? (isCurrentOutcome(true) ? 'Update' : 'Switch to Will Happen') : 'Will Happen'}
              </button>
              <button
                type="button"
                onClick={() => submitOutcome(false)}
                disabled={isSubmitting || (isUpdate && isLocked && !isCurrentOutcome(false))}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all shadow-sm ${isCurrentOutcome(false)
                    ? 'bg-red-500 text-white border-red-600 hover:bg-red-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-red-50 hover:border-red-400 hover:text-red-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting ? '...' : isUpdate ? (isCurrentOutcome(false) ? 'Update' : 'Switch to Won\'t Happen') : 'Won\'t Happen'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {prediction.options?.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => submitOutcome(option.id)}
                  disabled={isSubmitting || (isUpdate && isLocked && !isCurrentOutcome(option.id))}
                  className={`w-full text-left rounded-lg border px-4 py-3 text-sm font-medium transition-all shadow-sm flex items-center justify-between ${isCurrentOutcome(option.id)
                      ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                      : 'bg-white text-gray-900 border-gray-300 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span>{option.text}</span>
                  <span className={`text-xs ${isCurrentOutcome(option.id) ? 'text-blue-100' : 'text-gray-400'}`}>
                    {isSubmitting ? '...' : isCurrentOutcome(option.id) ? 'Update' : 'Select'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isUpdate && isLocked && (
        <p className="mt-2 text-xs text-orange-600">
          Prediction is locked — you can reduce your CU but not increase it or change your side.
        </p>
      )}
      {!isUpdate && isLocked && (
        <p className="mt-2 text-xs text-blue-600">
          Prediction is locked for side changes after your first commitment. Choose your side carefully!
        </p>
      )}
      {!isUpdate && !isLocked && Number(cuAmount || 0) > maxCu && (
        <p className="mt-2 text-xs text-red-600">
          You only have {maxCu} CU available.
        </p>
      )}
      {isUpdate && !isLocked && Number(cuAmount || 0) > maxCu && (
        <p className="mt-2 text-xs text-red-600">
          You only have {maxCu} max CU available (including your previous commitment).
        </p>
      )}
    </div>
  )
}

