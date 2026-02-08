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

  // State
  const [cuAmount, setCuAmount] = useState(existingCommitment?.cuCommitted || 10)
  const [selectedOutcome, setSelectedOutcome] = useState<string | boolean | null>(
    existingCommitment?.binaryChoice !== undefined
      ? existingCommitment.binaryChoice
      : existingCommitment?.optionId || null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validation
  const maxCu = isUpdate
    ? userCuAvailable + (existingCommitment?.cuCommitted || 0)
    : userCuAvailable
  const isValid = selectedOutcome !== null && cuAmount >= 1 && cuAmount <= maxCu

  // Handle submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isValid) {
      setError('Please select an outcome and enter a valid CU amount')
      return
    }

    setIsSubmitting(true)

    try {
      const endpoint = `/api/predictions/${prediction.id}/commit`
      const method = isUpdate ? 'PATCH' : 'POST'

      const body: Record<string, unknown> = {
        cuCommitted: cuAmount,
      }

      if (prediction.outcomeType === 'BINARY') {
        body.binaryChoice = selectedOutcome as boolean
      } else {
        body.optionId = selectedOutcome as string
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
      onSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          {isUpdate ? 'Update Commitment' : 'Make a Commitment'}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Available CU: <span className="font-medium">{userCuAvailable}</span>
        </p>
      </div>

      {/* Outcome Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Select Outcome</label>
        <div className="mt-2 space-y-2">
          {prediction.outcomeType === 'BINARY' ? (
            // Binary toggle
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedOutcome(true)}
                className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  selectedOutcome === true
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Will Happen
              </button>
              <button
                type="button"
                onClick={() => setSelectedOutcome(false)}
                className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  selectedOutcome === false
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Won&apos;t Happen
              </button>
            </div>
          ) : (
            // Multiple choice radio buttons
            <div className="space-y-2">
              {prediction.options?.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center rounded-md border px-4 py-3 transition-colors ${
                    selectedOutcome === option.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="outcome"
                    value={option.id}
                    checked={selectedOutcome === option.id}
                    onChange={(e) => setSelectedOutcome(e.target.value)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">{option.text}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CU Amount */}
      <div>
        <label htmlFor="cuAmount" className="block text-sm font-medium text-gray-700">
          CU Amount
        </label>
        <div className="mt-2 space-y-2">
          <input
            type="range"
            id="cuAmount"
            min="1"
            max={maxCu}
            value={cuAmount}
            onChange={(e) => setCuAmount(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex items-center justify-between">
            <input
              type="number"
              min="1"
              max={maxCu}
              value={cuAmount}
              onChange={(e) => setCuAmount(Number(e.target.value))}
              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="text-sm text-gray-500">
              Max: {maxCu} CU
            </span>
          </div>
        </div>
        {cuAmount > userCuAvailable && isUpdate && (
          <p className="mt-1 text-xs text-yellow-600">
            Increasing by {cuAmount - (existingCommitment?.cuCommitted || 0)} CU
          </p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Validation Feedback */}
      {!isValid && (
        <div className="text-sm text-gray-500">
          {selectedOutcome === null && '• Please select an outcome'}
          {cuAmount < 1 && '• CU amount must be at least 1'}
          {cuAmount > maxCu && '• Insufficient CU available'}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : isUpdate ? 'Update Commitment' : 'Commit CU'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
