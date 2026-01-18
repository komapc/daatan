'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  PlusCircle,
  Trash2,
  Calendar,
  Link as LinkIcon,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { forecastFormSchema, type ForecastFormData } from '@/lib/validations/forecast'

type ForecastFormProps = {
  onSubmit?: (data: ForecastFormData) => Promise<void>
  initialData?: Partial<ForecastFormData>
  isLoading?: boolean
}

const ForecastForm = ({ onSubmit, initialData, isLoading = false }: ForecastFormProps) => {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ForecastFormData>({
    resolver: zodResolver(forecastFormSchema),
    defaultValues: {
      title: initialData?.title ?? '',
      text: initialData?.text ?? '',
      type: initialData?.type ?? 'BINARY',
      dueDate: initialData?.dueDate ?? '',
      status: initialData?.status ?? 'DRAFT',
      options: initialData?.options ?? [{ text: 'Yes' }, { text: 'No' }],
      sourceArticles: initialData?.sourceArticles ?? [],
    },
  })

  const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
    control,
    name: 'options',
  })

  const { fields: sourceFields, append: appendSource, remove: removeSource } = useFieldArray({
    control,
    name: 'sourceArticles',
  })

  const type = watch('type')
  const title = watch('title')
  const text = watch('text')

  const handleTypeChange = (newType: 'BINARY' | 'MULTIPLE_CHOICE') => {
    setValue('type', newType)
    if (newType === 'BINARY') {
      setValue('options', [{ text: 'Yes' }, { text: 'No' }])
    }
  }

  const handleAddOption = () => {
    if (optionFields.length >= 10) return
    appendOption({ text: '' })
  }

  const handleRemoveOption = (index: number) => {
    if (optionFields.length <= 2) return
    removeOption(index)
  }

  const handleFormSubmit = (status: 'DRAFT' | 'ACTIVE') => {
    return handleSubmit(async (data) => {
      const submitData: ForecastFormData = {
        ...data,
        status,
        dueDate: new Date(data.dueDate).toISOString(),
        sourceArticles: data.sourceArticles?.filter(s => s.url) ?? [],
      }
      await onSubmit?.(submitData)
    })
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
          {...register('title')}
          placeholder="e.g., Will Bitcoin reach $100k by end of 2026?"
          className={`w-full px-4 py-3 rounded-lg border ${
            errors.title ? 'border-red-500' : 'border-gray-200'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          maxLength={500}
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.title.message}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-400">{title?.length ?? 0}/500</p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
          Description (optional)
        </label>
        <textarea
          id="text"
          {...register('text')}
          placeholder="Add context, criteria for resolution, or additional details..."
          rows={4}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          maxLength={5000}
        />
        <p className="mt-1 text-sm text-gray-400">{text?.length ?? 0}/5000</p>
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
          {optionFields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <span className="flex items-center justify-center w-8 h-12 text-sm text-gray-400">
                {index + 1}.
              </span>
              <input
                type="text"
                {...register(`options.${index}.text`)}
                placeholder={`Option ${index + 1}`}
                disabled={type === 'BINARY'}
                className={`flex-1 px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  type === 'BINARY' ? 'bg-gray-50' : ''
                }`}
                maxLength={500}
              />
              {type === 'MULTIPLE_CHOICE' && optionFields.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveOption(index)}
                  className="p-3 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Remove option"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
        
        {type === 'MULTIPLE_CHOICE' && optionFields.length < 10 && (
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
            {errors.options.message || errors.options.root?.message}
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
            {...register('dueDate')}
            min={minDate}
            className={`w-full pl-12 pr-4 py-3 rounded-lg border ${
              errors.dueDate ? 'border-red-500' : 'border-gray-200'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
        {errors.dueDate && (
          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.dueDate.message}
          </p>
        )}
      </div>

      {/* Source Articles */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Source Articles (optional)
        </label>
        <div className="space-y-3">
          {sourceFields.map((field, index) => (
            <div key={field.id} className="space-y-2 p-4 bg-gray-50 rounded-lg">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    {...register(`sourceArticles.${index}.url`)}
                    placeholder="https://example.com/article"
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSource(index)}
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
                  {...register(`sourceArticles.${index}.title`)}
                  placeholder="Article title (optional)"
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              {errors.sourceArticles?.[index]?.url && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.sourceArticles[index]?.url?.message}
                </p>
              )}
            </div>
          ))}
        </div>
        
        <button
          type="button"
          onClick={() => appendSource({ url: '', title: '' })}
          className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
        >
          <PlusCircle className="w-5 h-5" />
          Add Source Article
        </button>
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-4 pt-4">
        <button
          type="button"
          onClick={handleFormSubmit('DRAFT')}
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
          onClick={handleFormSubmit('ACTIVE')}
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
