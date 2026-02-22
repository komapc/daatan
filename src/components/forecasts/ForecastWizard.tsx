'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Newspaper,
  FileText,
  Target,
  Rocket,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
} from 'lucide-react'
import { StepNewsAnchor } from './steps/StepNewsAnchor'
import { StepPrediction } from './steps/StepPrediction'
import { StepOutcome } from './steps/StepOutcome'
import { StepPublish } from './steps/StepPublish'

export type PredictionFormData = {
  // Step 1: News Anchor
  newsAnchorId?: string
  newsAnchorUrl?: string
  newsAnchorTitle?: string

  // Step 2: Prediction
  claimText: string
  detailsText?: string
  tags: string[]

  // Step 3: Outcome
  outcomeType: 'BINARY' | 'MULTIPLE_CHOICE' | 'NUMERIC_THRESHOLD'
  outcomeOptions?: string[]
  numericThreshold?: {
    metric: string
    threshold: number
    direction: 'above' | 'below' | 'exactly'
  }
  resolveByDatetime: string
  resolutionRules?: string

  // Step 4: Publish
  cuCommitted?: number
}

const STEPS = [
  { id: 1, title: 'News Anchor', icon: Newspaper, description: 'Select a news story' },
  { id: 2, title: 'Prediction', icon: FileText, description: 'Write your claim' },
  { id: 3, title: 'Outcome', icon: Target, description: 'Define resolution' },
  { id: 4, title: 'Publish', icon: Rocket, description: 'Commit & publish' },
]

interface ForecastWizardProps {
  isExpressFlow?: boolean
}

export const ForecastWizard = ({ isExpressFlow = false }: ForecastWizardProps) => {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(isExpressFlow ? 2 : 1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<PredictionFormData>({
    claimText: '',
    tags: [],
    outcomeType: 'BINARY',
    resolveByDatetime: '',
  })

  // Load express prediction data from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    if (!isExpressFlow) return

    const stored = localStorage.getItem('expressPredictionData')
    if (!stored) return

    try {
      const data = JSON.parse(stored)
      localStorage.removeItem('expressPredictionData')

      // Convert ISO datetime (e.g. "2026-06-15T12:00:00.000Z") to YYYY-MM-DD
      // because <input type="date"> requires that format
      let resolveDate = data.resolveByDatetime || ''
      if (resolveDate && resolveDate.includes('T')) {
        resolveDate = resolveDate.split('T')[0]
      }

      // Determine outcome type — default to BINARY if not recognized
      const outcomeType = data.outcomeType === 'MULTIPLE_CHOICE' ? 'MULTIPLE_CHOICE' : 'BINARY'
      const outcomeOptions = outcomeType === 'MULTIPLE_CHOICE' && Array.isArray(data.options)
        ? data.options.filter((o: string) => o.trim())
        : undefined

      setFormData({
        claimText: data.claimText || '',
        detailsText: data.detailsText || '',
        tags: data.tags || [],
        outcomeType,
        outcomeOptions,
        resolveByDatetime: resolveDate,
        resolutionRules: data.resolutionRules || '',
        newsAnchorUrl: data.newsAnchor?.url || '',
        newsAnchorTitle: data.newsAnchor?.title || '',
      })
    } catch {
      // Invalid JSON — ignore
    }
  }, [isExpressFlow])

  const updateFormData = (updates: Partial<PredictionFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    const minStep = isExpressFlow ? 2 : 1
    if (currentStep > minStep) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSubmit = async (asDraft: boolean = false) => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Build outcome payload
      let outcomePayload: Record<string, unknown> = {}
      if (formData.outcomeType === 'BINARY') {
        outcomePayload = { type: 'BINARY' }
      } else if (formData.outcomeType === 'MULTIPLE_CHOICE' && formData.outcomeOptions) {
        outcomePayload = { type: 'MULTIPLE_CHOICE', options: formData.outcomeOptions }
      } else if (formData.outcomeType === 'NUMERIC_THRESHOLD' && formData.numericThreshold) {
        outcomePayload = { type: 'NUMERIC_THRESHOLD', ...formData.numericThreshold }
      }

      // Create prediction
      const response = await fetch('/api/forecasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newsAnchorId: formData.newsAnchorId,
          newsAnchorUrl: formData.newsAnchorUrl,
          newsAnchorTitle: formData.newsAnchorTitle,
          claimText: formData.claimText,
          detailsText: formData.detailsText,
          tags: formData.tags, // Added tags
          outcomeType: formData.outcomeType,
          outcomePayload,
          resolutionRules: formData.resolutionRules,
          resolveByDatetime: new Date(formData.resolveByDatetime).toISOString(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create prediction')
      }

      const prediction = await response.json()

      // If not draft, publish immediately
      if (!asDraft) {
        const publishResponse = await fetch(`/api/forecasts/${prediction.id}/publish`, {
          method: 'POST',
        })

        if (!publishResponse.ok) {
          const data = await publishResponse.json()
          throw new Error(data.error || 'Failed to publish prediction')
        }
      }

      window.dispatchEvent(new CustomEvent('daatan:first-action'))

      // Redirect to prediction page
      router.push(`/forecasts/${prediction.slug || prediction.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepNewsAnchor formData={formData} updateFormData={updateFormData} />
      case 2:
        return <StepPrediction formData={formData} updateFormData={updateFormData} />
      case 3:
        return <StepOutcome formData={formData} updateFormData={updateFormData} />
      case 4:
        return <StepPublish formData={formData} updateFormData={updateFormData} />
      default:
        return null
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true // News anchor is optional
      case 2:
        return formData.claimText.length >= 10
      case 3:
        return formData.resolveByDatetime && new Date(formData.resolveByDatetime) > new Date()
      case 4:
        return true
      default:
        return false
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Steps */}
      <nav className="mb-8">
        <ol className="flex items-center justify-between">
          {STEPS.filter(step => !isExpressFlow || step.id !== 1).map((step, index, filteredSteps) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id

            return (
              <li key={step.id} className="flex items-center min-w-0 flex-1">
                <button
                  onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                  disabled={step.id > currentStep}
                  className={`
                    flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-colors w-full min-w-0
                    ${isActive ? 'bg-blue-50 text-blue-600' : ''}
                    ${isCompleted ? 'text-green-600 cursor-pointer hover:bg-green-50' : ''}
                    ${!isActive && !isCompleted ? 'text-gray-400 cursor-not-allowed' : ''}
                  `}
                >
                  <div className={`
                    w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0
                    ${isActive ? 'bg-blue-600 text-white' : ''}
                    ${isCompleted ? 'bg-green-500 text-white' : ''}
                    ${!isActive && !isCompleted ? 'bg-gray-200' : ''}
                  `}>
                    {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icon className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </div>
                  <div className="hidden sm:block text-left min-w-0">
                    <div className="font-medium text-sm truncate">{step.title}</div>
                    <div className="text-xs text-gray-500 truncate">{step.description}</div>
                  </div>
                </button>
                {index < filteredSteps.length - 1 && (
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300 mx-1 sm:mx-2 shrink-0" />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={handleBack}
          disabled={currentStep === (isExpressFlow ? 2 : 1)}
          className={`
            flex items-center gap-2 px-4 sm:px-6 py-3 rounded-lg font-medium transition-colors
            ${currentStep === (isExpressFlow ? 2 : 1)
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-gray-100'
            }
          `}
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex gap-2 sm:gap-3">
          {currentStep === 4 ? (
            <>
              <button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="px-4 sm:px-6 py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Draft'}
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || !canProceed()}
                className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    <span className="hidden sm:inline">Publish Prediction</span>
                    <span className="sm:hidden">Publish</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

