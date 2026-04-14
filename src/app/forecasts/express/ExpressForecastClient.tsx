'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Search, FileText, Loader2, AlertCircle, Edit2, RotateCcw, ArrowLeft, X, Plus, List, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('ExpressForecast')

interface ExpressForecastClientProps {
  userId: string
  initialInput?: string
  onInputChange?: (val: string) => void
}

interface GeneratedPrediction {
  claimText: string
  resolveByDatetime: string
  detailsText: string
  tags: string[]
  resolutionRules: string
  outcomeType: 'BINARY' | 'MULTIPLE_CHOICE'
  options: string[]
  probabilitySuggestion: number
  probabilityReasoning: string
  newsAnchor: {
    url: string
    title: string
    snippet: string
    source?: string
  } | null
  additionalLinks: Array<{
    url: string
    title: string
  }>
}

type Step = 'input' | 'searching' | 'analyzing' | 'generating' | 'review' | 'error'

export default function ExpressForecastClient({ 
  userId, 
  initialInput = '', 
  onInputChange 
}: ExpressForecastClientProps) {
  const router = useRouter()
  const [userInput, setUserInput] = useState(initialInput)

  const handleUserInputChange = (val: string) => {
    setUserInput(val)
    onInputChange?.(val)
  }
  const [step, setStep] = useState<Step>('input')
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState<GeneratedPrediction | null>(null)
  const [progressMessage, setProgressMessage] = useState('')
  const [articlesFound, setArticlesFound] = useState(0)
  const [sourcesSummary, setSourcesSummary] = useState('')
  const [predictionPreview, setPredictionPreview] = useState<{ claim: string; resolveBy: string } | null>(null)

  const [skipSources, setSkipSources] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isGuessing, setIsGuessing] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [editForm, setEditForm] = useState<GeneratedPrediction | null>(null)
  const [newTag, setNewTag] = useState('')

  const examples = [
    "Bitcoin will reach $100k this year",
    "Who will win the next Champions League?",
    "AI will pass the Turing test by 2027",
    "Which country will host the 2036 Olympics?",
  ]

  const handleGenerate = async () => {
    if (!userInput.trim() || userInput.length < 5) {
      setError('Please enter at least 5 characters')
      return
    }

    // URL detection for UI feedback
    const isUrl = /^(https?:\/\/[^\s]+)$/i.test(userInput.trim())

    setError('')
    setStep(skipSources ? 'analyzing' : 'searching')
    setProgressMessage(skipSources ? 'Analyzing your input...' : isUrl ? 'Fetching article content...' : 'Searching for relevant articles...')
    setArticlesFound(0)
    setSourcesSummary('')
    setPredictionPreview(null)

    try {
      const response = await fetch('/api/forecasts/express/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput, skipSources }),
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
              setSourcesSummary(data.data?.sources || '')
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
              } else if (data.error === 'OFFENSIVE_INPUT') {
                setError(data.message)
              } else if (data.message?.startsWith('OFFENSIVE_INPUT:')) {
                const aiReason = data.message.split('OFFENSIVE_INPUT:')[1].trim()
                setError(`Moderation: ${aiReason}`)
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
    setSourcesSummary('')
    setPredictionPreview(null)
  }

  const handleRegenerateFromEdit = () => {
    if (editForm?.claimText) {
      setUserInput(editForm.claimText)
      setStep('input')
      setIsEditing(false)
      // Delay to ensure state update before triggering
      setTimeout(() => {
        handleGenerate()
      }, 50)
    }
  }

  const handleGuessChances = async () => {
    if (!generated) return
    setIsGuessing(true)
    setError('')

    try {
      const articles = [
        ...(generated.newsAnchor ? [{ title: generated.newsAnchor.title, source: generated.newsAnchor.source || 'News', snippet: generated.newsAnchor.snippet }] : []),
        ...generated.additionalLinks.map(l => ({ title: l.title, source: 'Related', snippet: '' }))
      ]

      const response = await fetch('/api/forecasts/express/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimText: generated.claimText,
          detailsText: generated.detailsText,
          articles,
        }),
      })

      if (!response.ok) throw new Error('Failed to guess chances')
      const result = await response.json()

      setGenerated({
        ...generated,
        probabilitySuggestion: result.probability,
        probabilityReasoning: result.reasoning
      })
    } catch (err) {
      log.error({ err }, 'Guess chances error')
      setError('Failed to get probability suggestion')
    } finally {
      setIsGuessing(false)
    }
  }

  const handleCreatePrediction = async () => {
    const finalData = isEditing ? editForm : generated
    if (!finalData) return

    if (new Date(finalData.resolveByDatetime) <= new Date()) {
      setError('Resolution date must be in the future')
      return
    }

    setIsPublishing(true)
    setError('')

    try {
      // 1. Create the prediction (as draft)
      const createResponse = await fetch('/api/forecasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimText: finalData.claimText,
          detailsText: finalData.detailsText,
          resolutionRules: finalData.resolutionRules,
          resolveByDatetime: finalData.resolveByDatetime,
          outcomeType: finalData.outcomeType,
          outcomePayload: finalData.outcomeType === 'MULTIPLE_CHOICE' ? { options: finalData.options } : undefined,
          tags: finalData.tags,
          newsAnchorUrl: finalData.newsAnchor?.url || undefined,
          newsAnchorTitle: finalData.newsAnchor?.title || undefined,
          source: finalData.newsAnchor ? undefined : 'manual',
          isPublic,
          confidence: finalData.probabilitySuggestion || undefined,
        }),
      })

      if (!createResponse.ok) {
        const errData = await createResponse.json()
        throw new Error(errData.error || 'Failed to create forecast')
      }

      const prediction = await createResponse.json()

      // 2. Publish the prediction (DRAFT -> ACTIVE)
      const publishResponse = await fetch(`/api/forecasts/${prediction.id}/publish`, {
        method: 'POST',
      })

      if (!publishResponse.ok) {
        const errData = await publishResponse.json()
        throw new Error(errData.error || 'Created as draft, but failed to publish')
      }

      // Success: redirect to the new prediction page
      router.push(`/forecasts/${prediction.id}?newly_created=true`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish prediction')
      setIsPublishing(false)
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

  // Option management in edit mode
  const handleOptionChange = (index: number, value: string) => {
    if (!editForm) return
    const newOptions = [...(editForm.options || [])]
    newOptions[index] = value
    setEditForm({ ...editForm, options: newOptions })
  }

  const addOption = () => {
    if (!editForm) return
    if ((editForm.options || []).length < 10) {
      setEditForm({ ...editForm, options: [...(editForm.options || []), ''] })
    }
  }

  const removeOption = (index: number) => {
    if (!editForm) return
    const newOptions = (editForm.options || []).filter((_, i) => i !== index)
    setEditForm({ ...editForm, options: newOptions })
  }

  return (
    <div className="space-y-6">
      {/* Input Step */}
      {step === 'input' && (
        <div className="bg-navy-700 border border-navy-600 rounded-3xl p-6 sm:p-8 shadow-sm">
          <label htmlFor="prediction-input" className="block text-sm font-bold text-text-secondary mb-3">
            What do you want to forecast?
          </label>
          <textarea
            id="prediction-input"
            value={userInput}
            onChange={(e) => handleUserInputChange(e.target.value)}
            placeholder="Describe your event OR paste a news article URL..."
            className="w-full px-4 py-3 bg-navy-800 text-white placeholder:text-text-subtle border border-navy-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cobalt focus:border-transparent resize-none"
            rows={3}
            maxLength={1000} // Increased for URLs
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">{userInput.length}/1000 characters</span>
            {/^(https?:\/\/[^\s]+)$/i.test(userInput.trim()) && (
              <span className="text-xs text-blue-600 font-medium">URL detected - will read article and find related sources</span>
            )}
          </div>

          <label className="flex items-center gap-3 mt-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipSources}
              onChange={(e) => setSkipSources(e.target.checked)}
              className="w-4 h-4 rounded border-navy-500 bg-navy-800 accent-cobalt"
            />
            <span className="text-sm text-text-secondary">
              Create without a news source
              <span className="block text-xs text-gray-500 font-normal">AI generates from your input only — no web search</span>
            </span>
          </label>

          {error && (
            <div className="mt-4 bg-red-900/20 border border-red-800/50 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!userInput.trim() || userInput.length < 5}
            fullWidth
            size="xl"
            leftIcon={<Sparkles className="w-5 h-5" />}
            className="mt-6"
          >
            Generate Forecast
          </Button>

          <div className="mt-8 pt-6 border-t border-navy-600">
            <p className="text-sm font-bold text-text-secondary mb-3">Examples:</p>
            <div className="space-y-2">
              {examples.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setUserInput(example)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-navy-800 rounded-lg transition-colors truncate"
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
        <div className="bg-navy-700 border border-navy-600 rounded-3xl p-8 shadow-sm">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-center mb-6">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            </div>

            <div className="space-y-4">
              {!skipSources && (
              <div className={`flex items-center gap-3 ${step === 'searching' ? 'text-blue-600' : step === 'input' ? 'text-gray-400' : 'text-green-600'}`}>
                <Search className="w-5 h-5" />
                <div className="flex-1">
                  <span className="font-medium">Searching / Fetching...</span>
                  {articlesFound > 0 && (
                    <span className="ml-2 text-sm text-gray-400">
                      ({sourcesSummary || `${articlesFound} found`})
                    </span>
                  )}
                </div>
                {step !== 'searching' && step !== 'input' && <span className="ml-auto text-green-600">✓</span>}
              </div>
              )}

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
              <p className="text-center text-sm text-gray-300 mt-4 font-medium">
                {progressMessage}
              </p>
            )}

            {predictionPreview && (
              <div className="mt-6 p-4 bg-cobalt/10 border border-cobalt/30 rounded-xl">
                <p className="text-sm font-bold text-blue-900 mb-2">Preview:</p>
                <p className="text-sm text-cobalt-light">{predictionPreview.claim}</p>
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
        <div className="bg-navy-700 border border-navy-600 rounded-3xl p-8 shadow-sm">
          <div className="max-w-md mx-auto text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Couldn&apos;t Generate Forecast</h3>
            <p className="text-gray-300 mb-6">{error}</p>
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
        <div className="bg-navy-700 border border-navy-600 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex justify-between items-start border-b border-navy-600 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Review Forecast</h2>
              <p className="text-sm text-gray-300">
                Review and refine the generated forecast before publishing.
              </p>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <button
                  onClick={handleRegenerateFromEdit}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-900/20 rounded-lg hover:bg-purple-100 transition-colors"
                  title="Regenerate from this claim"
                >
                  <Sparkles className="w-4 h-4" />
                  Regenerate
                </button>
              ) : (
                <>
                  <button
                    onClick={handleGenerate}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-cobalt/10 rounded-lg transition-colors"
                    title="Regenerate"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => { setIsEditing(true); setEditForm(generated) }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-cobalt/10 rounded-lg hover:bg-blue-100 transition-colors"
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
              <h3 className="text-sm font-bold text-text-secondary mb-2">Forecast Claim</h3>
              {isEditing ? (
                <textarea
                  value={editForm?.claimText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(prev => prev ? ({ ...prev, claimText: e.target.value }) : null)}
                  className="w-full p-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              ) : (
                <p className="text-lg text-white">{generated.claimText}</p>
              )}
            </div>

            {/* Resolution Date */}
            <div>
              <h3 className="text-sm font-bold text-text-secondary mb-2">Resolution Date</h3>
              {isEditing ? (
                <input
                  type="datetime-local"
                  value={editForm?.resolveByDatetime?.slice(0, 16)} // Format for input
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const d = new Date(e.target.value)
                    setEditForm(prev => prev ? ({ ...prev, resolveByDatetime: isNaN(d.getTime()) ? e.target.value : d.toISOString() }) : null)
                  }}
                  className={`w-full p-3 rounded-lg border bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${editForm?.resolveByDatetime && new Date(editForm.resolveByDatetime) <= new Date() ? 'border-red-500' : 'border-gray-300'}`}
                />
              ) : (
                <p className="text-white">
                  {new Date(generated.resolveByDatetime).toLocaleString(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                </p>
              )}
            </div>

            {/* Tags */}
            <div>
              <h3 className="text-sm font-bold text-text-secondary mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {(isEditing ? editForm?.tags : generated.tags)?.map((tag: string, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-navy-700 text-text-secondary rounded-full text-sm">
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
                      className="px-3 py-1 rounded-full text-sm w-32 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button onClick={addTag} className="p-1 text-blue-600 hover:bg-cobalt/10 rounded-full">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Outcome Type & Options */}
            <div>
              <h3 className="text-sm font-bold text-text-secondary mb-2">Outcome Type</h3>
              <div className="flex items-center gap-2 mb-3">
                {generated.outcomeType === 'MULTIPLE_CHOICE' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    <List className="w-4 h-4" />
                    Multiple Choice
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-cobalt-light rounded-full text-sm font-medium">
                    Binary (Yes / No)
                  </span>
                )}
              </div>
              {((isEditing ? editForm?.outcomeType : generated.outcomeType) === 'MULTIPLE_CHOICE') && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Options</h4>
                  {isEditing ? (
                    <div className="space-y-2">
                      {(editForm?.options || []).map((option: string, index: number) => (
                        <div key={index} className="flex gap-2">
                          <span className="flex items-center justify-center w-8 text-sm text-gray-400">
                            {index + 1}.
                          </span>
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                            className="flex-1 px-3 py-2 rounded-lg text-sm border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={500}
                          />
                          {(editForm?.options || []).length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(index)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              aria-label={`Remove option ${index + 1}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {(editForm?.options || []).length < 10 && (
                        <button
                          type="button"
                          onClick={addOption}
                          className="flex items-center gap-1.5 text-blue-600 hover:text-cobalt-light text-sm mt-1"
                        >
                          <Plus className="w-4 h-4" />
                          Add Option
                        </button>
                      )}
                    </div>
                  ) : (
                    <ol className="space-y-1.5">
                      {(generated.options || []).map((option, index) => (
                        <li key={index} className="flex items-center gap-2 text-mist">
                          <span className="flex items-center justify-center w-6 h-6 bg-navy-700 text-gray-500 rounded-full text-xs font-medium">
                            {index + 1}
                          </span>
                          {option}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>

            {/* Context */}
            <div>
              <h3 className="text-sm font-bold text-text-secondary mb-2">Context</h3>
              {isEditing ? (
                <textarea
                  value={editForm?.detailsText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(prev => prev ? ({ ...prev, detailsText: e.target.value }) : null)}
                  className="w-full p-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              ) : (
                <p className="text-text-secondary">{generated.detailsText}</p>
              )}
            </div>

            {/* Resolution Rules */}
            <div>
              <h3 className="text-sm font-bold text-text-secondary mb-2">Resolution Rules</h3>
              {isEditing ? (
                <textarea
                  value={editForm?.resolutionRules}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditForm(prev => prev ? ({ ...prev, resolutionRules: e.target.value }) : null)}
                  className="w-full p-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              ) : (
                <p className="text-text-secondary italic">{generated.resolutionRules}</p>
              )}
            </div>

            {/* AI Probability Suggestion */}
            {!isEditing && (
              <div className="p-4 bg-purple-900/20 border border-purple-100 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    AI Probability Guess
                  </h3>
                  {!generated.probabilitySuggestion && (
                    <Button
                      onClick={handleGuessChances}
                      loading={isGuessing}
                      size="sm"
                      variant="outline"
                      className="text-xs py-1 h-auto"
                    >
                      Guess chances
                    </Button>
                  )}
                </div>
                {generated.probabilitySuggestion ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl font-black text-purple-600">
                        {generated.probabilitySuggestion}%
                      </div>
                      <div className="text-sm text-purple-800 leading-tight">
                        {generated.probabilityReasoning}
                      </div>
                    </div>
                    <button 
                      onClick={handleGuessChances}
                      className="text-[10px] uppercase tracking-wider font-bold text-purple-400 hover:text-purple-600 transition-colors"
                    >
                      Recalculate
                    </button>
                  </div>
                ) : !isGuessing && (
                  <p className="text-xs text-purple-600/70">
                    Let AI analyze the gathered sources to suggest a starting probability.
                  </p>
                )}
              </div>
            )}

            {/* News Anchor */}
            {generated.newsAnchor ? (
              <div>
                <h3 className="text-sm font-bold text-text-secondary mb-2">News Anchor</h3>
                <a
                  href={generated.newsAnchor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border border-navy-600 rounded-xl hover:border-blue-300 hover:bg-cobalt/10 transition-colors"
                >
                  <p className="font-medium text-white mb-1">{generated.newsAnchor.title}</p>
                  {generated.newsAnchor.source && (
                    <p className="text-sm text-gray-500">{generated.newsAnchor.source}</p>
                  )}
                </a>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-bold text-text-secondary mb-2">Source</h3>
                <div className="p-4 border border-purple-500/30 bg-purple-500/10 rounded-xl">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-400 px-2 py-0.5 bg-purple-500/20 rounded-full mb-1">Personal</span>
                  <p className="text-sm text-gray-400">Generated from your input — no news source attached.</p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-navy-600 space-y-3">
            {/* Visibility toggle */}
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsPublic(v => !v)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  isPublic
                    ? 'bg-teal/10 text-teal border-green-200 hover:bg-green-100'
                    : 'bg-navy-800 text-gray-400 border-navy-600 hover:bg-navy-700'
                }`}
              >
                <span>{isPublic ? 'Public — visible in the feed' : 'Unlisted — only people with the link'}</span>
                {isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            )}

            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <Button
                    onClick={handleSaveEdit}
                    fullWidth
                    size="xl"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Save Changes
                  </Button>
                  <Button
                    onClick={() => { setIsEditing(false); setEditForm(null) }}
                    variant="outline"
                    size="xl"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleCreatePrediction}
                    loading={isPublishing}
                    fullWidth
                    size="xl"
                    leftIcon={<Sparkles className="w-5 h-5" />}
                  >
                    Confirm & Publish
                  </Button>
                  <Button
                    onClick={handleTryAgain}
                    disabled={isPublishing}
                    variant="outline"
                    size="xl"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
