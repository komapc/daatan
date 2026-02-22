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
  commitments?: { binaryChoice?: boolean | null, optionId?: string | null, cuCommitted: number }[]
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

  // Pending confirmation state for penalty
  const [pendingOutcome, setPendingOutcome] = useState<string | boolean | null>(null)
  const [penaltyInfo, setPenaltyInfo] = useState<{ cuBurned: number, cuRefunded: number, burnRate: number } | null>(null)

  // After lock: can change side or increase CU, but penalty applies.
  // Always allow the full available balance (existing commitment is returned minus penalty).
  const maxCu = isUpdate
    ? userCuAvailable + existingCommitment.cuCommitted // conservative: as if all refunded
    : userCuAvailable

  const handleActionClick = (outcomeValue: string | boolean) => {
    setError(null)
    const numericCu = Number(cuAmount)

    if (!numericCu || numericCu < 1 || numericCu > maxCu) {
      setError(`Please enter a valid amount (1 - ${maxCu} CU)`)
      return
    }

    const isSideChanged = isUpdate && !isCurrentOutcome(outcomeValue)
    const isCuIncreased = isUpdate && isCurrentOutcome(outcomeValue) && numericCu > existingCommitment.cuCommitted

    if (isUpdate && isLocked && (isSideChanged || isCuIncreased)) {
      // Calculate penalty preview
      const oldCu = existingCommitment.cuCommitted

      let yourSideCU = 0
      let totalPoolCU = 0

      if (prediction.commitments) {
        for (const c of prediction.commitments) {
          if (c.binaryChoice !== null && c.binaryChoice !== undefined) {
            if (c.binaryChoice === existingCommitment.binaryChoice) yourSideCU += c.cuCommitted
            totalPoolCU += c.cuCommitted
          } else if (c.optionId) {
            if (c.optionId === existingCommitment.optionId) yourSideCU += c.cuCommitted
            totalPoolCU += c.cuCommitted
          }
        }
      } else {
        // Fallback if not loaded
        yourSideCU = oldCu
        totalPoolCU = oldCu * 2
      }

      const poolShare = totalPoolCU > 0 ? yourSideCU / totalPoolCU : 0
      const burnRate = Math.max(0.10, poolShare)
      const cuBurned = Math.floor(oldCu * burnRate)
      const cuRefunded = oldCu - cuBurned

      setPenaltyInfo({ cuBurned, cuRefunded, burnRate: Math.round(burnRate * 100) })
      setPendingOutcome(outcomeValue)
      return
    }

    // Otherwise submit immediately
    submitOutcome(outcomeValue)
  }

  const submitOutcome = async (outcomeValue: string | boolean) => {
    setError(null)
    const numericCu = Number(cuAmount)

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
                onClick={() => handleActionClick(true)}
                disabled={isSubmitting || pendingOutcome !== null}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all shadow-sm ${isCurrentOutcome(true)
                  ? 'bg-green-600 text-white border-green-700 hover:bg-green-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-green-50 hover:border-green-400 hover:text-green-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting ? '...' : isUpdate ? (isCurrentOutcome(true) ? 'Update' : 'Switch to Will Happen') : 'Will Happen'}
              </button>
              <button
                type="button"
                onClick={() => handleActionClick(false)}
                disabled={isSubmitting || pendingOutcome !== null}
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
                  onClick={() => handleActionClick(option.id)}
                  disabled={isSubmitting || pendingOutcome !== null}
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

      {pendingOutcome !== null && penaltyInfo && (
        <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg shadow-sm">
          <h4 className="text-sm font-semibold text-orange-800 mb-2">Confirm Exit Penalty</h4>
          <p className="text-sm text-orange-700 mb-3">
            Because this prediction is locked, changing your side or increasing your CU incurs a penalty.
            The penalty burns a percentage of your original commitment based on your side&apos;s share of the pool.
          </p>
          <ul className="text-sm text-orange-800 space-y-1 mb-4">
            <li>Original Commitment: <strong>{existingCommitment?.cuCommitted} CU</strong></li>
            <li>Burn Rate: <strong>{penaltyInfo.burnRate}%</strong></li>
            <li>Amount Burned: <strong>{penaltyInfo.cuBurned} CU</strong></li>
            <li>Amount Refunded: <strong>{penaltyInfo.cuRefunded} CU</strong></li>
          </ul>
          <div className="flex gap-3">
            <button
              onClick={() => submitOutcome(pendingOutcome)}
              disabled={isSubmitting}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Confirming...' : 'Accept Penalty & Continue'}
            </button>
            <button
              onClick={() => {
                setPendingOutcome(null)
                setPenaltyInfo(null)
              }}
              disabled={isSubmitting}
              className="flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isUpdate && isLocked && pendingOutcome === null && (
        <p className="mt-2 text-xs text-orange-600">
          ⚠️ Prediction is locked — changing your side or increasing your CU will incur
          an exit penalty (min 10%, based on pool share). Reducing CU on the same side is free.
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

