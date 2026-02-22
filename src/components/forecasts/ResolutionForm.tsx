'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Ban, HelpCircle, Sparkles, Loader2 } from 'lucide-react'

interface ResolutionFormProps {
  predictionId: string
  outcomeType: string
  options: Array<{ id: string; text: string }>
  onResolved?: () => void
}

export function ResolutionForm({ predictionId, outcomeType, options, onResolved }: ResolutionFormProps) {
  const [outcome, setOutcome] = useState<'correct' | 'wrong' | 'void' | 'unresolvable'>('correct')
  const [correctOptionId, setCorrectOptionId] = useState<string>('')
  const [evidenceLinks, setEvidenceLinks] = useState<string>('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAiResearch = async () => {
    setIsResearching(true)
    setError(null)

    try {
      const response = await fetch(`/api/forecasts/${predictionId}/research`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to perform AI research')
      }

      const data = await response.json()
      setOutcome(data.outcome)
      setEvidenceLinks(data.evidenceLinks.join('\n'))
      setResolutionNote(data.reasoning)
      if (data.correctOptionId) {
        setCorrectOptionId(data.correctOptionId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI research failed')
    } finally {
      setIsResearching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const isMultipleChoice = outcomeType === 'MULTIPLE_CHOICE'
    if (isMultipleChoice && (outcome === 'correct' || outcome === 'wrong') && !correctOptionId) {
      setError('Please select the correct option')
      setIsSubmitting(false)
      return
    }

    try {
      const links = evidenceLinks
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

      const response = await fetch(`/api/forecasts/${predictionId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          evidenceLinks: links.length > 0 ? links : undefined,
          resolutionNote: resolutionNote.trim() || undefined,
          correctOptionId: isMultipleChoice ? correctOptionId : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to resolve prediction')
      }

      onResolved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve prediction')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isMultipleChoice = outcomeType === 'MULTIPLE_CHOICE'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Resolve Forecast</h3>
        <button
          type="button"
          onClick={handleAiResearch}
          disabled={isResearching || isSubmitting}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
        >
          {isResearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          AI Assist
        </button>
      </div>

      {/* Outcome Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Outcome</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOutcome('correct')}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${outcome === 'correct'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-green-300'
              }`}
          >
            <CheckCircle className={`w-5 h-5 ${outcome === 'correct' ? 'text-green-600' : 'text-gray-400'}`} />
            <div className="text-left">
              <div className="font-medium text-gray-900">Correct</div>
              <div className="text-xs text-gray-500">Prediction came true</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOutcome('wrong')}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${outcome === 'wrong'
              ? 'border-red-500 bg-red-50'
              : 'border-gray-200 hover:border-red-300'
              }`}
          >
            <XCircle className={`w-5 h-5 ${outcome === 'wrong' ? 'text-red-600' : 'text-gray-400'}`} />
            <div className="text-left">
              <div className="font-medium text-gray-900">Wrong</div>
              <div className="text-xs text-gray-500">Prediction did not happen</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOutcome('void')}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${outcome === 'void'
              ? 'border-yellow-500 bg-yellow-50'
              : 'border-gray-200 hover:border-yellow-300'
              }`}
          >
            <Ban className={`w-5 h-5 ${outcome === 'void' ? 'text-yellow-600' : 'text-gray-400'}`} />
            <div className="text-left">
              <div className="font-medium text-gray-900">Void</div>
              <div className="text-xs text-gray-500">Invalid prediction</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOutcome('unresolvable')}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${outcome === 'unresolvable'
              ? 'border-gray-400 bg-gray-50'
              : 'border-gray-200 hover:border-gray-300'
              }`}
          >
            <HelpCircle className={`w-5 h-5 ${outcome === 'unresolvable' ? 'text-gray-600' : 'text-gray-400'}`} />
            <div className="text-left">
              <div className="font-medium text-gray-900">Unresolvable</div>
              <div className="text-xs text-gray-500">Cannot determine</div>
            </div>
          </button>
        </div>
      </div>

      {/* Multiple Choice Option Selector */}
      {isMultipleChoice && (outcome === 'correct' || outcome === 'wrong') && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Which option was correct?</label>
          <div className="grid grid-cols-1 gap-2">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setCorrectOptionId(option.id)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all text-sm ${correctOptionId === option.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
              >
                <span>{option.text}</span>
                {correctOptionId === option.id && <CheckCircle className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Links */}
      <div>
        <label htmlFor="evidence" className="block text-sm font-medium text-gray-700 mb-2">
          Evidence Links
        </label>
        <textarea
          id="evidence"
          value={evidenceLinks}
          onChange={(e) => setEvidenceLinks(e.target.value)}
          placeholder="https://example.com/source-article"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">One URL per line (optional)</p>
      </div>

      {/* Resolution Note */}
      <div>
        <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-2">
          Resolution Note
        </label>
        <textarea
          id="note"
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
          placeholder="Brief explanation for the users..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {isSubmitting ? 'Resolving...' : 'Confirm Resolution'}
      </button>
    </form>
  )
}
