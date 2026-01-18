'use client'

import { useState } from 'react'
import {
  PlusCircle,
  Trash2,
  Calendar,
  Link as LinkIcon,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react'

type ForecastType = 'BINARY' | 'MULTIPLE_CHOICE'
type ForecastStatus = 'DRAFT' | 'ACTIVE'

type SourceArticle = {
  url: string
  title?: string
}

type ForecastOption = {
  id: string
  text: string
}

type ForecastFormProps = {
  onSubmit?: (data: ForecastFormData) => Promise<void>
  initialData?: Partial<ForecastFormData>
  isLoading?: boolean
}

export type ForecastFormData = {
  title: string
  text: string
  type: ForecastType
  dueDate: string
  status: ForecastStatus
  options: { text: string }[]
  sourceArticles: SourceArticle[]
}

const generateId = () => Math.random().toString(36).substr(2, 9)

const ForecastForm = ({ onSubmit, initialData, isLoading = false }: ForecastFormProps) => {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [text, setText] = useState(initialData?.text ?? '')
  const [type, setType] = useState<ForecastType>(initialData?.type ?? 'BINARY')
  const [dueDate, setDueDate] = useState(initialData?.dueDate ?? '')
  const [status, setStatus] = useState<ForecastStatus>(initialData?.status ?? 'DRAFT')
  
  const [options, setOptions] = useState<ForecastOption[]>(
    initialData?.options?.map(o => ({ id: generateId(), text: o.text })) ?? [
      { id: generateId(), text: 'Yes' },
      { id: generateId(), text: 'No' },
    ]
  )
  
  const [sourceArticles, setSourceArticles] = useState<(SourceArticle & { id: string })[]>(
    initialData?.sourceArticles?.map(s => ({ ...s, id: generateId() })) ?? []
  )
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleTypeChange = (newType: ForecastType) => {
    setType(newType)
    if (newType === 'BINARY') {
      setOptions([
        { id: generateId(), text: 'Yes' },
        { id: generateId(), text: 'No' },
      ])
    }
  }

  const handleAddOption = () => {
    if (options.length >= 10) return
    setOptions([...options, { id: generateId(), text: '' }])
  }

  const handleRemoveOption = (id: string) => {
    if (options.length <= 2) return
    setOptions(options.filter(o => o.id !== id))
  }

  const handleOptionChange = (id: string, text: string) => {
    setOptions(options.map(o => o.id === id ? { ...o, text } : o))
  }

  const handleAddSource = () => {
    setSourceArticles([...sourceArticles, { id: generateId(), url: '', title: '' }])
  }

  const handleRemoveSource = (id: string) => {
    setSourceArticles(sourceArticles.filter(s => s.id !== id))
  }

  const handleSourceChange = (id: string, field: 'url' | 'title', value: string) => {
    setSourceArticles(sourceArticles.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (title.length < 10) {
      newErrors.title = 'Title must be at least 10 characters'
    }

    if (!dueDate) {
      newErrors.dueDate = 'Due date is required'
    } else if (new Date(dueDate) <= new Date()) {
      newErrors.dueDate = 'Due date must be in the future'
    }

    if (options.some(o => !o.text.trim())) {
      newErrors.options = 'All options must have text'
    }

    if (type === 'BINARY' && options.length !== 2) {
      newErrors.options = 'Binary forecasts must have exactly 2 options'
    }

    if (type === 'MULTIPLE_CHOICE' && options.length < 2) {
      newErrors.options = 'At least 2 options are required'
    }

    // Validate source URLs
    const invalidUrls = sourceArticles.filter(s => s.url && !isValidUrl(s.url))
    if (invalidUrls.length > 0) {
      newErrors.sources = 'Invalid URL format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent, submitStatus: ForecastStatus) => {
    e.preventDefault()
    
    setStatus(submitStatus)
    
    if (!validate()) return

    const data: ForecastFormData = {
      title,
      text,
      type,
      dueDate: new Date(dueDate).toISOString(),
      status: submitStatus,
      options: options.map(o => ({ text: o.text })),
      sourceArticles: sourceArticles
        .filter(s => s.url)
        .map(s => ({ url: s.url, title: s.title || undefined })),
    }

    await onSubmit?.(data)
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <form className="space-y-6">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          Forecast Title *
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Will Bitcoin reach $100k by end of 2026?"
          className={`w-full px-4 py-3 rounded-lg border ${
            errors.title ? 'border-red-500' : 'border-gray-200'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          maxLength={500}
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.title}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-400">{title.length}/500</p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
          Description (optional)
        </label>
        <textarea
          id="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add context, criteria for resolution, or additional details..."
          rows={4}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          maxLength={5000}
        />
        <p className="mt-1 text-sm text-gray-400">{text.length}/5000</p>
      </div>

      {/* Forecast Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Forecast Type
        </label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => handleTypeChange('BINARY')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
              type === 'BINARY'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">Binary</div>
            <div className="text-sm text-gray-500">Yes / No</div>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('MULTIPLE_CHOICE')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
              type === 'MULTIPLE_CHOICE'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">Multiple Choice</div>
            <div className="text-sm text-gray-500">Up to 10 options</div>
          </button>
        </div>
      </div>

      {/* Options */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Answer Options *
        </label>
        <div className="space-y-3">
          {options.map((option, index) => (
            <div key={option.id} className="flex gap-2">
              <span className="flex items-center justify-center w-8 h-12 text-sm text-gray-400">
                {index + 1}.
              </span>
              <input
                type="text"
                value={option.text}
                onChange={(e) => handleOptionChange(option.id, e.target.value)}
                placeholder={`Option ${index + 1}`}
                disabled={type === 'BINARY'}
                className={`flex-1 px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  type === 'BINARY' ? 'bg-gray-50' : ''
                }`}
                maxLength={500}
              />
              {type === 'MULTIPLE_CHOICE' && options.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveOption(option.id)}
                  className="p-3 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Remove option"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
        
        {type === 'MULTIPLE_CHOICE' && options.length < 10 && (
          <button
            type="button"
            onClick={handleAddOption}
            className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
            Add Option
          </button>
        )}
        
        {errors.options && (
          <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.options}
          </p>
        )}
      </div>

      {/* Due Date */}
      <div>
        <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-2">
          Resolution Date *
        </label>
        <div className="relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="date"
            id="dueDate"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            min={minDate}
            className={`w-full pl-12 pr-4 py-3 rounded-lg border ${
              errors.dueDate ? 'border-red-500' : 'border-gray-200'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
        {errors.dueDate && (
          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.dueDate}
          </p>
        )}
      </div>

      {/* Source Articles */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Source Articles (optional)
        </label>
        <div className="space-y-3">
          {sourceArticles.map((source) => (
            <div key={source.id} className="space-y-2 p-4 bg-gray-50 rounded-lg">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    value={source.url}
                    onChange={(e) => handleSourceChange(source.id, 'url', e.target.value)}
                    placeholder="https://example.com/article"
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveSource(source.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Remove source"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={source.title || ''}
                  onChange={(e) => handleSourceChange(source.id, 'title', e.target.value)}
                  placeholder="Article title (optional)"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          ))}
        </div>
        
        <button
          type="button"
          onClick={handleAddSource}
          className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
        >
          <PlusCircle className="w-5 h-5" />
          Add Source Article
        </button>
        
        {errors.sources && (
          <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.sources}
          </p>
        )}
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-4 pt-4">
        <button
          type="button"
          onClick={(e) => handleSubmit(e, 'DRAFT')}
          disabled={isLoading}
          className="flex-1 py-3 px-6 rounded-lg border-2 border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            'Save as Draft'
          )}
        </button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e, 'ACTIVE')}
          disabled={isLoading}
          className="flex-1 py-3 px-6 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            'Publish Forecast'
          )}
        </button>
      </div>
    </form>
  )
}

export default ForecastForm

