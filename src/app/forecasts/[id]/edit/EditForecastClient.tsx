'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ChevronLeft,
  Calendar,
  Lock,
  Unlock,
  Info,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { PrimaryLink } from '@/components/ui/PrimaryLink'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('EditForecast')

interface Prediction {
  id: string
  slug: string | null
  claimText: string
  detailsText: string | null
  resolutionRules: string | null
  resolveByDatetime: string
  status: string
  isPublic: boolean
  userId: string
}

interface EditForecastClientProps {
  id: string
}

export default function EditForecastClient({ id }: EditForecastClientProps) {
  const router = useRouter()
  const t = useTranslations('Forecasts')
  const f = useTranslations('forecast')
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    claimText: '',
    detailsText: '',
    resolutionRules: '',
    resolveByDatetime: '',
    isPublic: true,
  })

  useEffect(() => {
    async function fetchPrediction() {
      try {
        const response = await fetch(`/api/forecasts/${id}`)
        if (!response.ok) {
          if (response.status === 404) throw new Error(t('notFound'))
          if (response.status === 403) throw new Error('You do not have permission to edit this forecast')
          throw new Error('Failed to load forecast')
        }
        const data = await response.json()
        setPrediction(data)
        
        // Initialize form
        const resolveDate = new Date(data.resolveByDatetime)
        setFormData({
          claimText: data.claimText || '',
          detailsText: data.detailsText || '',
          resolutionRules: data.resolutionRules || '',
          resolveByDatetime: resolveDate.toISOString().slice(0, 16),
          isPublic: data.isPublic !== false,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPrediction()
  }, [id, t])

  const handleChange = (field: string, value: string | number | boolean | Date | null | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setSaveSuccess(false)
    setSaveError(null)
  }

  const handleSave = async () => {
    if (!prediction) return
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const payload = {
        ...formData,
        resolveByDatetime: new Date(formData.resolveByDatetime).toISOString()
      }

      const response = await fetch(`/api/forecasts/${prediction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData?.error || `${t('saveError')} (${response.status})`)
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
        isPublic: updated.isPublic !== false,
      })
    } catch (err) {
      log.error({ err }, 'Error saving forecast')
      setSaveError(err instanceof Error ? err.message : t('saveError'))
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
            {error || t('notFound')}
          </h2>
          <PrimaryLink href="/">
            {t('backToFeed')}
          </PrimaryLink>
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
        {t('backToForecast')}
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {t('title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Status: <span className="font-medium capitalize">{f(prediction.status.toLowerCase()).toLowerCase()}</span>
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Claim Text */}
        <div>
          <label htmlFor="claimText" className="block text-sm font-medium text-gray-700 mb-2">
            {t('claimLabel')} <span className="text-red-500">*</span>
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
            {t('detailsLabel')}
          </label>
          <textarea
            id="detailsText"
            value={formData.detailsText}
            onChange={(e) => handleChange('detailsText', e.target.value)}
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add more details, links, or context..."
          />
        </div>

        {/* Resolution Rules */}
        <div>
          <label htmlFor="resolutionRules" className="block text-sm font-medium text-gray-700 mb-2">
            {t('resolutionRulesLabel')}
          </label>
          <textarea
            id="resolutionRules"
            value={formData.resolutionRules}
            onChange={(e) => handleChange('resolutionRules', e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="How will this be resolved? Which sources will be used?"
          />
        </div>

        {/* Resolve By Date */}
        <div>
          <label htmlFor="resolveByDatetime" className="block text-sm font-medium text-gray-700 mb-2">
            {t('resolveByLabel')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="datetime-local"
              id="resolveByDatetime"
              value={formData.resolveByDatetime}
              onChange={(e) => handleChange('resolveByDatetime', e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Predictions are usually resolved within 24 hours of this date.
          </p>
        </div>

        {/* Visibility */}
        <div className="pt-2">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            {t('visibilityLabel')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleChange('isPublic', true)}
              className={`flex items-center gap-3 p-4 border rounded-xl transition-all ${
                formData.isPublic 
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`p-2 rounded-lg ${formData.isPublic ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                <Unlock className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold">{t('public')}</div>
                <div className="text-xs text-gray-500">{t('publicDesc')}</div>
              </div>
            </button>

            <button
              onClick={() => handleChange('isPublic', false)}
              className={`flex items-center gap-3 p-4 border rounded-xl transition-all ${
                !formData.isPublic 
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`p-2 rounded-lg ${!formData.isPublic ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold">{t('unlisted')}</div>
                <div className="text-xs text-gray-500">{t('unlistedDesc')}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleSave}
            loading={isSaving}
            disabled={!formData.claimText || !formData.resolveByDatetime}
            className="sm:flex-1"
            leftIcon={<Save className="w-4 h-4" />}
          >
            {t('saveChanges')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push(`/forecasts/${prediction.slug || prediction.id}`)}
            className="sm:flex-none"
          >
            {t('cancel')}
          </Button>
        </div>

        {/* Status Messages */}
        {saveSuccess && (
          <div className="bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">{t('saveSuccess')}</span>
          </div>
        )}

        {saveError && (
          <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{saveError}</span>
          </div>
        )}
      </div>
    </div>
  )
}
