import { useState, useEffect, useRef } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import type { PredictionFormData } from '../ForecastWizard'
import { TagSelector } from '@/components/ui/TagSelector'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('StepPrediction')

type Props = {
  formData: PredictionFormData
  updateFormData: (updates: Partial<PredictionFormData>) => void
}

export const StepPrediction = ({ formData, updateFormData }: Props) => {
  const [isSuggesting, setIsSuggesting] = useState(false)
  const lastSuggestedClaim = useRef('')

  const claimLength = formData.claimText?.length || 0
  const detailsLength = formData.detailsText || '' ? String(formData.detailsText).length : 0
  const isClaimTooShort = claimLength > 0 && claimLength < 10

  // Auto-suggest tags when user types a meaningful claim
  useEffect(() => {
    const claim = formData.claimText?.trim() || ''

    // Trigger if claim is substantial (e.g. > 20 chars) and has changed since last suggestion
    if (claim.length >= 20 && claim !== lastSuggestedClaim.current && !isSuggesting) {
      const timer = setTimeout(async () => {
        setIsSuggesting(true)
        lastSuggestedClaim.current = claim
        try {
          const res = await fetch('/api/ai/suggest-tags', {
            method: 'POST',
            body: JSON.stringify({ claim, details: formData.detailsText })
          })
          if (res.ok) {
            const data = await res.json()
            if (data.tags?.length > 0) {
              // Combine existing and new tags, unikified, max 5
              const currentTags = formData.tags || []
              const combined = Array.from(new Set([...currentTags, ...data.tags])).slice(0, 5)
              updateFormData({ tags: combined })
            }
          }
        } catch (error) {
          log.warn({ err: error }, 'Failed to auto-suggest tags')
        } finally {
          setIsSuggesting(false)
        }
      }, 1500) // 1.5s debounce

      return () => clearTimeout(timer)
    }
  }, [formData.claimText, formData.detailsText, formData.tags, updateFormData, isSuggesting])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Write Your Forecast
        </h2>
        <p className="text-gray-500">
          Make a specific, testable claim about what will happen.
        </p>
      </div>

      {/* Claim Text */}
      <div>
        <label htmlFor="claimText" className="block text-sm font-medium text-gray-700 mb-2">
          Prediction Claim *
        </label>
        <textarea
          id="claimText"
          value={formData.claimText}
          onChange={(e) => updateFormData({ claimText: e.target.value })}
          placeholder="e.g., Bitcoin will reach $100,000 before July 2026"
          rows={3}
          maxLength={500}
          className={`w-full px-4 py-3 rounded-lg border ${isClaimTooShort ? 'border-amber-500' : 'border-gray-200'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none`}
        />
        <div className="flex justify-between mt-1">
          {isClaimTooShort && (
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Claim must be at least 10 characters
            </p>
          )}
          <p className="text-sm text-gray-400 ml-auto">{claimLength}/500</p>
        </div>
      </div>

      {/* Details Text */}
      <div>
        <label htmlFor="detailsText" className="block text-sm font-medium text-gray-700 mb-2">
          Additional Details
          <span className="text-gray-400 font-normal ml-2">(optional)</span>
        </label>
        <textarea
          id="detailsText"
          value={formData.detailsText || ''}
          onChange={(e) => updateFormData({ detailsText: e.target.value })}
          placeholder="Add context, conditions, or criteria for resolution..."
          rows={4}
          maxLength={5000}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <p className="text-sm text-gray-400 mt-1 text-right">{detailsLength}/5000</p>
      </div>

      {/* Tags */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
            Tags
            <span className="text-gray-400 font-normal ml-1">(optional, max 5)</span>
            {isSuggesting && (
              <span className="flex items-center gap-1.5 text-blue-600 text-xs font-bold animate-pulse ml-2 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">
                <Loader2 className="w-3 h-3 animate-spin" />
                AI is categorizing...
              </span>
            )}
          </label>
        </div>
        <TagSelector
          selectedTags={formData.tags || []}
          onChange={(tags) => updateFormData({ tags })}
          placeholder="Add tags (e.g. Politics, Crypto)..."
        />
        <p className="text-xs text-gray-400 mt-2 italic">
          Tip: You can skip tags and proceed directly to the next step.
        </p>
      </div>

      {/* Tips */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h3 className="font-medium text-amber-800 mb-2">💡 Tips for good predictions</h3>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• Be specific and measurable</li>
          <li>• Include a clear timeframe</li>
          <li>• Define what counts as success</li>
          <li>• Avoid ambiguous language</li>
        </ul>
      </div>
    </div>
  )
}

