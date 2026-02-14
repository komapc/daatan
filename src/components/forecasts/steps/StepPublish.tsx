'use client'

import {
  Newspaper,
  FileText,
  Target,
  Calendar,
  Check,
} from 'lucide-react'
import type { PredictionFormData } from '../ForecastWizard'

type Props = {
  formData: PredictionFormData
  updateFormData: (updates: Partial<PredictionFormData>) => void
}

export const StepPublish = ({ formData }: Props) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Not set'
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getOutcomeDescription = () => {
    switch (formData.outcomeType) {
      case 'BINARY':
        return 'Binary (Will happen / Won\'t happen)'
      case 'MULTIPLE_CHOICE':
        return `Multiple Choice (${formData.outcomeOptions?.length || 0} options)`
      case 'NUMERIC_THRESHOLD':
        if (formData.numericThreshold) {
          const { metric, direction, threshold } = formData.numericThreshold
          return `${metric} ${direction} ${threshold}`
        }
        return 'Numeric Threshold'
      default:
        return 'Not set'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Review & Publish
        </h2>
        <p className="text-gray-500">
          Review your prediction before publishing. Once published, it cannot be edited.
        </p>
      </div>

      {/* Summary Card */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* News Anchor */}
        {formData.newsAnchorTitle && (
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Newspaper className="w-4 h-4" />
              News Anchor
            </div>
            <p className="font-medium text-gray-900">{formData.newsAnchorTitle}</p>
            {formData.newsAnchorUrl && (
              <a
                href={formData.newsAnchorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {new URL(formData.newsAnchorUrl).hostname}
              </a>
            )}
          </div>
        )}

        {/* Prediction */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <FileText className="w-4 h-4" />
            Prediction
          </div>
          <p className="font-medium text-gray-900 text-lg">{formData.claimText || 'No claim set'}</p>
          {formData.detailsText && (
            <p className="text-gray-600 mt-2">{formData.detailsText}</p>
          )}
          {formData.tags && formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {formData.tags.map((tag, i) => (
                <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Outcome */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Target className="w-4 h-4" />
            Outcome Type
          </div>
          <p className="font-medium text-gray-900">{getOutcomeDescription()}</p>

          {formData.outcomeType === 'MULTIPLE_CHOICE' && formData.outcomeOptions && (
            <ul className="mt-2 space-y-1">
              {formData.outcomeOptions.map((option, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                    {index + 1}
                  </span>
                  {option}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Resolution */}
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Calendar className="w-4 h-4" />
            Resolution Deadline
          </div>
          <p className="font-medium text-gray-900">{formatDate(formData.resolveByDatetime)}</p>
          {formData.resolutionRules && (
            <p className="text-sm text-gray-600 mt-2">{formData.resolutionRules}</p>
          )}
        </div>
      </div>

      {/* Publish Checklist */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="font-medium text-green-800 mb-3">Ready to publish?</h3>
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-sm text-green-700">
            <Check className="w-4 h-4" />
            Your prediction will be visible to all users
          </li>
          <li className="flex items-center gap-2 text-sm text-green-700">
            <Check className="w-4 h-4" />
            Others can commit CU to agree or disagree
          </li>
          <li className="flex items-center gap-2 text-sm text-green-700">
            <Check className="w-4 h-4" />
            It will be resolved by {formatDate(formData.resolveByDatetime)}
          </li>
        </ul>
      </div>

      {/* Draft Notice */}
      <p className="text-sm text-gray-500 text-center">
        Not ready yet? You can <span className="font-medium">Save as Draft</span> and publish later.
      </p>
    </div>
  )
}

