'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Ban, HelpCircle } from 'lucide-react'

interface ResolutionFormProps {
  predictionId: string
  onResolved?: () => void
}

export function ResolutionForm({ predictionId, onResolved }: ResolutionFormProps) {
  const [outcome, setOutcome] = useState<'correct' | 'wrong' | 'void' | 'unresolvable'>('correct')
  const [evidenceLinks, setEvidenceLinks] = useState<string>('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

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

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resolve Forecast</h3>

        {/* Outcome Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Outcome</label>

          <button
            type="button"
            onClick={() => setOutcome('correct')}
            className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${outcome === 'correct'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-green-300'
              }`}
          >
            <CheckCircle className={`w-5 h-5 ${outcome === 'correct' ? 'text-green-600' : 'text-gray-400'}`} />
            <div className="text-left">
              <div className="font-medium text-gray-900">Correct</div>
              <div className="text-sm text-gray-500">The prediction came true</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOutcome('wrong')}
            className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${outcome === 'wrong'
              ? 'border-red-500 bg-red-50'
              : 'border-gray-200 hover:border-red-300'
              }`}
          >
            <XCircle className={`w-5 h-5 ${outcome === 'wrong' ? 'text-red-600' : 'text-gray-400'}`} />
            <div className="text-left">
              <div className="font-medium text-gray-900">Wrong</div>
              <div className="text-sm text-gray-500">The prediction did not come true</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOutcome('void')}
            className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${outcome === 'void'
              ? 'border-yellow-500 bg-yellow-50'
              : 'border-gray-200 hover:border-yellow-300'
              }`}
          >
            <Ban className={`w-5 h-5 ${outcome === 'void' ? 'text-yellow-600' : 'text-gray-400'}`} />
            <div className="text-left">
              <div className="font-medium text-gray-900">Void</div>
              <div className="text-sm text-gray-500">Invalid prediction (refund all CU)</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setOutcome('unresolvable')}
            className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${outcome === 'unresolvable'
              ? 'border-gray-500 bg-gray-50'
              : 'border-gray-200 hover:border-gray-300'
              }`}
          >
            <HelpCircle className={`w-5 h-5 ${outcome === 'unresolvable' ? 'text-gray-600' : 'text-gray-400'}`} />
            <div className="text-left">
              <div className="font-medium text-gray-900">Unresolvable</div>
              <div className="text-sm text-gray-500">Cannot determine outcome (refund all CU)</div>
            </div>
          </button>
        </div>
      </div>

      {/* Evidence Links */}
      <div>
        <label htmlFor="evidence" className="block text-sm font-medium text-gray-700 mb-2">
          Evidence Links (optional)
        </label>
        <textarea
          id="evidence"
          value={evidenceLinks}
          onChange={(e) => setEvidenceLinks(e.target.value)}
          placeholder="https://example.com/article1&#10;https://example.com/article2"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-1 text-sm text-gray-500">One URL per line</p>
      </div>

      {/* Resolution Note */}
      <div>
        <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-2">
          Resolution Note (optional)
        </label>
        <textarea
          id="note"
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
          placeholder="Explain the resolution decision..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Resolving...' : 'Resolve Forecast'}
      </button>
    </form>
  )
}
