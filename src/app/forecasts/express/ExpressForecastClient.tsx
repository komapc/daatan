'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Search, FileText, Loader2, AlertCircle, Edit2, RotateCcw, ArrowLeft, X, Plus } from 'lucide-react'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('ExpressForecast')

interface ExpressForecastClientProps {
  userId: string
}

interface GeneratedPrediction {
  claimText: string
  resolveByDatetime: string
  detailsText: string
  domain: string
  tags: string[]
  resolutionRules: string
  newsAnchor: {
    url: string
    title: string
    snippet: string
    source?: string
  }
  additionalLinks: Array<{
    url: string
    title: string
  }>
}

type Step = 'input' | 'searching' | 'analyzing' | 'generating' | 'review' | 'error'

export default function ExpressForecastClient({ userId }: ExpressForecastClientProps) {
  const router = useRouter()
  const [userInput, setUserInput] = useState('')
  const [step, setStep] = useState<Step>('input')
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState<GeneratedPrediction | null>(null)
  const [progressMessage, setProgressMessage] = useState('')
  const [articlesFound, setArticlesFound] = useState(0)
  const [predictionPreview, setPredictionPreview] = useState<{ claim: string; resolveBy: string } | null>(null)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<GeneratedPrediction | null>(null)
  const [newTag, setNewTag] = useState('')

  const examples = [
    "Bitcoin will reach $100k this year",
    "Trump will win 2024 US elections",
    "AI will pass the Turing test by 2025",
    "https://www.bbc.com/news/world-middle-east-12345678"
  ]

  const handleGenerate = async () => {
    if (!userInput.trim() || userInput.length < 5) {
      setError('Please enter at least 5 characters')
      return
    }

    // URL detection for UI feedback
    const isUrl = /^(https?:\/\/[^\s]+)$/i.test(userInput.trim())

    setError('')
    setStep('searching')
    setProgressMessage(isUrl ? 'Fetching article content...' : 'Searching for relevant articles...')
    setArticlesFound(0)
    setPredictionPreview(null)

    try {
      const response = await fetch('/api/forecasts/express/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate prediction')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response stream')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const data = JSON.parse(line)

            if (data.stage === 'searching') {
              setStep('searching')
              setProgressMessage(data.data?.message || 'Searching...')
            } else if (data.stage === 'found_articles') {
              setArticlesFound(data.data?.count || 0)
              setProgressMessage(data.data?.message || `Found ${data.data?.count} sources`)
              setStep('analyzing')
            } else if (data.stage === 'analyzing') {
              setStep('analyzing')
              setProgressMessage(data.data?.message || 'Analyzing context...')
            } else if (data.stage === 'prediction_formed') {
              setStep('generating')
              setProgressMessage(data.data?.message || 'Prediction formed')
              if (data.data?.preview) {
                setPredictionPreview(data.data.preview)
              }
            } else if (data.stage === 'finalizing') {
              setProgressMessage(data.data?.message || 'Finalizing...')
            } else if (data.stage === 'complete') {
              setGenerated(data.data)
              setEditForm(data.data) // Initialize edit form
              setStep('review')
            } else if (data.stage === 'error') {
              if (data.error === 'NO_ARTICLES_FOUND') {
                setError(data.message || "Couldn't find relevant articles. Try rephrasing.")
              } else {
                setError(data.message || 'Failed to generate prediction')
              }
              setStep('error')
            }
          } catch (e) {
            log.error({ err: e }, 'Failed to parse stream data')
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  const handleTryAgain = () => {
    setStep('input')
    setError('')
    setGenerated(null)
    setEditForm(null)
    setIsEditing(false)
    setProgressMessage('')
    setArticlesFound(0)
    setPredictionPreview(null)
  }

  const handleCreatePrediction = () => {
    const finalData = isEditing ? editForm : generated
    if (!finalData) return

    try {
      localStorage.setItem('expressPredictionData', JSON.stringify(finalData))
      window.location.href = '/create?from=express'
    } catch {
      setError('Failed to prepare prediction data')
      setStep('error')
    }
  }

  const handleSaveEdit = () => {
    if (editForm) {
      setGenerated(editForm)
      setIsEditing(false)
    }
  }

  // Tag management in edit mode
  const addTag = () => {
    if (newTag && editForm && !editForm.tags?.includes(newTag)) {
      setEditForm({
        ...editForm,
        tags: [...(editForm.tags || []), newTag]
      })
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    if (editForm) {
      setEditForm({
        ...editForm,
        tags: (editForm.tags || []).filter(t => t !== tag)
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Input Step */}
      {step === 'input' && (
        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm">
          <label htmlFor="prediction-input" className="block text-sm font-bold text-gray-700 mb-3">
            What do you want to forecast?
          </label>
          <textarea
            id="prediction-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Describe your event OR paste a news article URL..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
            maxLength={1000} // Increased for URLs
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">{userInput.length}/1000 characters</span>
            {/^(https?:\/\/[^\s]+)$/i.test(userInput.trim()) && (
              <span className="text-xs text-blue-600 font-medium">URL detected - will fetch content directly</span>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!userInput.trim() || userInput.length < 5}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="w-5 h-5" />
            Generate Forecast
          </button>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-sm font-bold text-gray-700 mb-3">Examples:</p>
            <div className="space-y-2">
              {examples.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setUserInput(example)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors truncate"
                >
                  • {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      {(['searching', 'analyzing', 'generating'] as Step[]).includes(step) && (
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-center mb-6">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            </div>

            <div className="space-y-4">
              <div className={`flex items-center gap-3 ${step === 'searching' ? 'text-blue-600' : step === 'input' ? 'text-gray-400' : 'text-green-600'}`}>
                <Search className="w-5 h-5" />
                <div className="flex-1">
                  <span className="font-medium">Searching / Fetching...</span>
                  {articlesFound > 0 && (
                    <span className="ml-2 text-sm text-gray-600">({articlesFound} found)</span>
                  )}
                </div>
                {step !== 'searching' && step !== 'input' && <span className="ml-auto text-green-600">✓</span>}
              </div>

              <div className={`flex items-center gap-3 ${step === 'analyzing' ? 'text-blue-600' : ['input', 'searching'].includes(step) ? 'text-gray-400' : 'text-green-600'}`}>
                <FileText className="w-5 h-5" />
                <span className="font-medium">Analyzing context...</span>
                {step === 'generating' && <span className="ml-auto text-green-600">✓</span>}
              </div>

              <div className={`flex items-center gap-3 ${step === 'generating' ? 'text-blue-600' : 'text-gray-400'}`}>
                <Sparkles className="w-5 h-5" />
                <span className="font-medium">Generating forecast...</span>
              </div>
            </div>

            {progressMessage && (
              <p className="text-center text-sm text-gray-600 mt-4 font-medium">
                {progressMessage}
              </p>
            )}

            {predictionPreview && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm font-bold text-blue-900 mb-2">Preview:</p>
                <p className="text-sm text-blue-800">{predictionPreview.claim}</p>
                <p className="text-xs text-blue-600 mt-1">
                  Resolves: {new Date(predictionPreview.resolveBy).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Step */}
      {step === 'error' && (
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
          <div className="max-w-md mx-auto text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Couldn&apos;t Generate Forecast</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={handleTryAgain}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Review Step */}
      {step === 'review' && generated && (
        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex justify-between items-start border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Review Forecast</h2>
              <p className="text-sm text-gray-600">
                Review and refine the generated forecast before publishing.
              </p>
            </div>
            <div className="flex gap-2">
              {!isEditing && (
                <>
                  <button
                    onClick={handleGenerate}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Regenerate"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => { setIsEditing(true); setEditForm(generated) }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Claim */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2">Forecast Claim</h3>
              {isEditing ? (
                <textarea
                  value={editForm?.claimText}
                  onChange={e => setEditForm(prev => prev ? ({ ...prev, claimText: e.target.value }) : null)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              ) : (
                <p className="text-lg text-gray-900">{generated.claimText}</p>
              )}
            </div>

            {/* Resolution Date */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2">Resolution Date</h3>
              {isEditing ? (
                <input
                  type="datetime-local"
                  value={editForm?.resolveByDatetime?.slice(0, 16)} // Format for input
                  onChange={e => setEditForm(prev => prev ? ({ ...prev, resolveByDatetime: new Date(e.target.value).toISOString() }) : null)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">
                  {new Date(generated.resolveByDatetime).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                </p>
              )}
            </div>

            {/* Tags */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {(isEditing ? editForm?.tags : generated.tags)?.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                    {tag}
                    {isEditing && (
                      <button onClick={() => removeTag(tag)} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
                {isEditing && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTag()}
                      placeholder="Add tag..."
                      className="px-3 py-1 border rounded-full text-sm w-32"
                    />
                    <button onClick={addTag} className="p-1 text-blue-600 hover:bg-blue-50 rounded-full">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Context */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2">Context</h3>
              {isEditing ? (
                <textarea
                  value={editForm?.detailsText}
                  onChange={e => setEditForm(prev => prev ? ({ ...prev, detailsText: e.target.value }) : null)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              ) : (
                <p className="text-gray-700">{generated.detailsText}</p>
              )}
            </div>

            {/* Resolution Rules */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2">Resolution Rules</h3>
              {isEditing ? (
                <textarea
                  value={editForm?.resolutionRules}
                  onChange={e => setEditForm(prev => prev ? ({ ...prev, resolutionRules: e.target.value }) : null)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              ) : (
                <p className="text-gray-700 italic">{generated.resolutionRules}</p>
              )}
            </div>

            {/* News Anchor */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2">News Anchor</h3>
              <a
                href={generated.newsAnchor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <p className="font-medium text-gray-900 mb-1">{generated.newsAnchor.title}</p>
                {generated.newsAnchor.source && (
                  <p className="text-sm text-gray-500">{generated.newsAnchor.source}</p>
                )}
              </a>
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-100">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditForm(null) }}
                  className="px-6 py-3 rounded-xl border border-gray-300 font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCreatePrediction}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
                >
                  Review & Publish
                </button>
                <button
                  onClick={handleTryAgain} // Uses "Start Over" logic but maybe we want "Back"
                  className="px-6 py-3 rounded-xl border border-gray-300 font-bold hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
