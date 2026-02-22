'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Loader2,
  AlertCircle,
  Save,
  X,
} from 'lucide-react'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('EditForecast')

type PredictionData = {
  id: string
  slug?: string
  claimText: string
  detailsText?: string | null
  outcomeType: string
  resolutionRules?: string | null
  resolveByDatetime: string
  status: string
  author: { id: string }
}

type EditFormData = {
  claimText: string
  detailsText: string
  resolutionRules: string
  resolveByDatetime: string
}

export default function EditForecastClient() {
  const params = useParams()
  const router = useRouter()
  const [prediction, setPrediction] = useState<PredictionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [formData, setFormData] = useState<EditFormData>({
    claimText: '',
    detailsText: '',
    resolutionRules: '',
    resolveByDatetime: '',
  })

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        const response = await fetch(`/api/forecasts/${params.id}`)
        if (!response.ok) {
          throw new Error('Failed to load forecast')
        }
        const data = await response.json()
        setPrediction(data)

        // Format the date for datetime-local input
        const resolveDate = new Date(data.resolveByDatetime)
        const localDatetime = resolveDate.toISOString().slice(0, 16)

        setFormData({
          claimText: data.claimText || '',
          detailsText: data.detailsText || '',
          resolutionRules: data.resolutionRules || '',
          resolveByDatetime: localDatetime,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setIsLoading(false)
      }
    }

    if (params.id) {
      fetchPrediction()
    }
  }, [params.id])

  const handleChange = (field: keyof EditFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setSaveError(null)
    setSaveSuccess(false)
  }

  const handleSave = async () => {
    if (!prediction) return

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // Build the update payload — only send changed fields
      const payload: Record<string, unknown> = {}

      if (formData.claimText !== (prediction.claimText || '')) {
        payload.claimText = formData.claimText
      }
      if (formData.detailsText !== (prediction.detailsText || '')) {
        payload.detailsText = formData.detailsText || null
      }
      if (formData.resolutionRules !== (prediction.resolutionRules || '')) {
        payload.resolutionRules = formData.resolutionRules || null
      }

      // Convert local datetime to ISO
      const newDate = new Date(formData.resolveByDatetime).toISOString()
      const origDate = new Date(prediction.resolveByDatetime).toISOString()
      if (newDate !== origDate) {
        payload.resolveByDatetime = newDate
      }

      if (Object.keys(payload).length === 0) {
        setSaveError('No changes to save')
        return
      }

      const response = await fetch(`/api/forecasts/${prediction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData?.error || `Save failed (${response.status})`)
      }

      const updated = await response.json()
      setPrediction(updated)
      setSaveSuccess(true)

      // Update form data with saved values
      const resolveDate = new Date(updated.resolveByDatetime)
      setFormData({
        claimText: updated.claimText || '',
        detailsText: updated.detailsText || '',
        resolutionRules: updated.resolutionRules || '',
        resolveByDatetime: resolveDate.toISOString().slice(0, 16),
      })
    } catch (err) {
      log.error({ err }, 'Error saving forecast')
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (error || !prediction) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error || 'Forecast not found'}
          </h2>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Feed
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Back Link */}
      <Link
        href={`/forecasts/${prediction.slug || prediction.id}`}
        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Forecast
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          Edit Forecast
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Status: <span className="font-medium capitalize">{prediction.status.replace('_', ' ').toLowerCase()}</span>
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Claim Text */}
        <div>
          <label htmlFor="claimText" className="block text-sm font-medium text-gray-700 mb-2">
            Claim Text <span className="text-red-500">*</span>
          </label>
          <textarea
            id="claimText"
            value={formData.claimText}
            onChange={(e) => handleChange('claimText', e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="What is the prediction?"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{formData.claimText.length}/500</p>
        </div>

        {/* Details Text */}
        <div>
          <label htmlFor="detailsText" className="block text-sm font-medium text-gray-700 mb-2">
            Details / Context
            <span className="text-gray-400 font-normal ml-2">(optional)</span>
          </label>
          <textarea
            id="detailsText"
            value={formData.detailsText}
            onChange={(e) => handleChange('detailsText', e.target.value)}
            rows={4}
            maxLength={5000}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Additional context or background..."
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{formData.detailsText.length}/5000</p>
        </div>

        {/* Resolution Rules */}
        <div>
          <label htmlFor="resolutionRules" className="block text-sm font-medium text-gray-700 mb-2">
            Resolution Rules
            <span className="text-gray-400 font-normal ml-2">(optional)</span>
          </label>
          <textarea
            id="resolutionRules"
            value={formData.resolutionRules}
            onChange={(e) => handleChange('resolutionRules', e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="How will this prediction be resolved?"
          />
        </div>

        {/* Resolution Deadline */}
        <div>
          <label htmlFor="resolveByDatetime" className="block text-sm font-medium text-gray-700 mb-2">
            Resolution Deadline <span className="text-red-500">*</span>
          </label>
          <input
            id="resolveByDatetime"
            type="datetime-local"
            value={formData.resolveByDatetime}
            onChange={(e) => handleChange('resolveByDatetime', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Error / Success Messages */}
        {saveError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            Forecast updated successfully.
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={isSaving || !formData.claimText.trim() || !formData.resolveByDatetime}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => router.push(`/forecasts/${prediction.slug || prediction.id}`)}
            className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
