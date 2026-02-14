'use client'

import { useState, useEffect } from 'react'
import { 
  ToggleLeft, 
  List, 
  TrendingUp, 
  Calendar,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react'
import type { PredictionFormData } from '../ForecastWizard'

type Props = {
  formData: PredictionFormData
  updateFormData: (updates: Partial<PredictionFormData>) => void
}

const OUTCOME_TYPES = [
  { 
    value: 'BINARY', 
    label: 'Binary', 
    icon: ToggleLeft,
    description: 'Will happen / Won\'t happen',
  },
  { 
    value: 'MULTIPLE_CHOICE', 
    label: 'Multiple Choice', 
    icon: List,
    description: 'One option out of many',
  },
  { 
    value: 'NUMERIC_THRESHOLD', 
    label: 'Numeric', 
    icon: TrendingUp,
    description: 'Metric crosses a value',
  },
]

export const StepOutcome = ({ formData, updateFormData }: Props) => {
  const [options, setOptions] = useState<string[]>(formData.outcomeOptions || ['', ''])
  
  const minDate = new Date().toISOString().split('T')[0]
  const isDateInPast = formData.resolveByDatetime && new Date(formData.resolveByDatetime) <= new Date()

  // Sync options with form data
  useEffect(() => {
    if (formData.outcomeType === 'MULTIPLE_CHOICE') {
      updateFormData({ outcomeOptions: options.filter(o => o.trim()) })
    }
  }, [options, formData.outcomeType, updateFormData])

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, ''])
    }
  }

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Define Outcome & Deadline
        </h2>
        <p className="text-gray-500">
          How will this prediction be resolved?
        </p>
      </div>

      {/* Outcome Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Outcome Type *
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OUTCOME_TYPES.map((type) => {
            const Icon = type.icon
            const isSelected = formData.outcomeType === type.value

            return (
              <button
                key={type.value}
                type="button"
                onClick={() => updateFormData({ outcomeType: type.value as PredictionFormData['outcomeType'] })}
                className={`
                  p-4 rounded-lg border-2 text-left transition-colors
                  ${isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <Icon className={`w-6 h-6 mb-2 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                  {type.label}
                </div>
                <div className="text-sm text-gray-500">{type.description}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Multiple Choice Options */}
      {formData.outcomeType === 'MULTIPLE_CHOICE' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Options *
          </label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <span className="flex items-center justify-center w-8 text-sm text-gray-400">
                  {index + 1}.
                </span>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={500}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Remove option"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 10 && (
            <button
              type="button"
              onClick={handleAddOption}
              className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Option
            </button>
          )}
        </div>
      )}

      {/* Numeric Threshold */}
      {formData.outcomeType === 'NUMERIC_THRESHOLD' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="metric" className="block text-sm font-medium text-gray-700 mb-2">
              Metric *
            </label>
            <input
              type="text"
              id="metric"
              value={formData.numericThreshold?.metric || ''}
              onChange={(e) => updateFormData({
                numericThreshold: {
                  ...formData.numericThreshold,
                  metric: e.target.value,
                  threshold: formData.numericThreshold?.threshold || 0,
                  direction: formData.numericThreshold?.direction || 'above',
                },
              })}
              placeholder="e.g., Bitcoin price in USD"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="direction" className="block text-sm font-medium text-gray-700 mb-2">
                Direction *
              </label>
              <select
                id="direction"
                value={formData.numericThreshold?.direction || 'above'}
                onChange={(e) => updateFormData({
                  numericThreshold: {
                    ...formData.numericThreshold,
                    metric: formData.numericThreshold?.metric || '',
                    threshold: formData.numericThreshold?.threshold || 0,
                    direction: e.target.value as 'above' | 'below' | 'exactly',
                  },
                })}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="above">Goes above</option>
                <option value="below">Goes below</option>
                <option value="exactly">Reaches exactly</option>
              </select>
            </div>

            <div>
              <label htmlFor="threshold" className="block text-sm font-medium text-gray-700 mb-2">
                Threshold Value *
              </label>
              <input
                type="number"
                id="threshold"
                value={formData.numericThreshold?.threshold || ''}
                onChange={(e) => updateFormData({
                  numericThreshold: {
                    ...formData.numericThreshold,
                    metric: formData.numericThreshold?.metric || '',
                    threshold: parseFloat(e.target.value) || 0,
                    direction: formData.numericThreshold?.direction || 'above',
                  },
                })}
                placeholder="100000"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Resolution Date */}
      <div>
        <label htmlFor="resolveByDatetime" className="block text-sm font-medium text-gray-700 mb-2">
          Resolution Deadline *
        </label>
        <div className="relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="date"
            id="resolveByDatetime"
            value={formData.resolveByDatetime}
            onChange={(e) => updateFormData({ resolveByDatetime: e.target.value })}
            min={minDate}
            className={`w-full pl-12 pr-4 py-3 rounded-lg border ${
              isDateInPast ? 'border-red-500' : 'border-gray-200'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
        {isDateInPast && (
          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Resolution date must be in the future
          </p>
        )}
      </div>

      {/* Resolution Rules */}
      <div>
        <label htmlFor="resolutionRules" className="block text-sm font-medium text-gray-700 mb-2">
          Resolution Rules
          <span className="text-gray-400 font-normal ml-2">(optional)</span>
        </label>
        <textarea
          id="resolutionRules"
          value={formData.resolutionRules || ''}
          onChange={(e) => updateFormData({ resolutionRules: e.target.value })}
          placeholder="How should this be resolved? What sources will be used?"
          rows={3}
          maxLength={2000}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>
    </div>
  )
}

