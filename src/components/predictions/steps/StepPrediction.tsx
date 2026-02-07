'use client'

import { AlertCircle } from 'lucide-react'
import type { PredictionFormData } from '../PredictionWizard'

type Props = {
  formData: PredictionFormData
  updateFormData: (updates: Partial<PredictionFormData>) => void
}

const DOMAINS = [
  { value: 'politics', label: 'Politics' },
  { value: 'tech', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'sports', label: 'Sports' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'science', label: 'Science' },
  { value: 'world', label: 'World Events' },
  { value: 'other', label: 'Other' },
]

export const StepPrediction = ({ formData, updateFormData }: Props) => {
  const claimLength = formData.claimText?.length || 0
  const detailsLength = formData.detailsText?.length || 0
  const isClaimTooShort = claimLength > 0 && claimLength < 10

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
          className={`w-full px-4 py-3 rounded-lg border ${
            isClaimTooShort ? 'border-amber-500' : 'border-gray-200'
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

      {/* Domain */}
      <div>
        <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
          Category
          <span className="text-gray-400 font-normal ml-2">(optional)</span>
        </label>
        <select
          id="domain"
          value={formData.domain || ''}
          onChange={(e) => updateFormData({ domain: e.target.value || undefined })}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="">Select a category...</option>
          {DOMAINS.map((domain) => (
            <option key={domain.value} value={domain.value}>
              {domain.label}
            </option>
          ))}
        </select>
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

