'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Search, FileText, Loader2, AlertCircle } from 'lucide-react'

interface ExpressPredictionClientProps {
  userId: string
}

interface GeneratedPrediction {
  claimText: string
  resolveByDatetime: string
  detailsText: string
  domain: string
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

export default function ExpressPredictionClient({ userId }: ExpressPredictionClientProps) {
  const router = useRouter()
  const [userInput, setUserInput] = useState('')
  const [step, setStep] = useState<Step>('input')
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState<GeneratedPrediction | null>(null)
  const [progressMessage, setProgressMessage] = useState('')
  const [articlesFound, setArticlesFound] = useState(0)
  const [predictionPreview, setPredictionPreview] = useState<{ claim: string; resolveBy: string } | null>(null)

  const examples = [
    "Bitcoin will reach $100k this year",
    "Trump will win 2024 US elections",
    "AI will pass the Turing test by 2025",
    "SpaceX will land humans on Mars by 2030"
  ]

  const handleGenerate = async () => {
    if (!userInput.trim() || userInput.length < 5) {
      setError('Please enter at least 5 characters')
      return
    }

    setError('')
    setStep('searching')
    setProgressMessage('Searching for relevant articles...')
    setArticlesFound(0)
    setPredictionPreview(null)

    try {
      const response = await fetch('/api/predictions/express/generate', {
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
            console.error('Failed to parse stream data:', e)
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
    setProgressMessage('')
    setArticlesFound(0)
    setPredictionPreview(null)
  }

  const handleCreatePrediction = () => {
    console.log('handleCreatePrediction called', { generated })
    if (!generated) {
      console.error('No generated data')
      return
    }
    
    try {
      // Store generated data in localStorage for the wizard to pick up
      localStorage.setItem('expressPredictionData', JSON.stringify(generated))
      console.log('Data stored in localStorage, navigating...')
      
      // Use window.location instead of router.push for more reliable navigation
      window.location.href = '/predictions/new?from=express'
    } catch (error) {
      console.error('Error in handleCreatePrediction:', error)
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
            placeholder="e.g., US vs Iran conflict this year"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
            maxLength={200}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">{userInput.length}/200 characters</span>
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
                  className="block w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
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
                  <span className="font-medium">Searching articles...</span>
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

            <p className="text-center text-sm text-gray-500 mt-6">
              This usually takes 10-15 seconds
            </p>
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
            <h3 className="text-lg font-bold text-gray-900 mb-2">Couldn't Generate Forecast</h3>
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
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">Forecast Claim</h3>
            <p className="text-lg text-gray-900">{generated.claimText}</p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">Resolution Date</h3>
            <p className="text-gray-900">
              {new Date(generated.resolveByDatetime).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">Context</h3>
            <p className="text-gray-700">{generated.detailsText}</p>
          </div>

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

          {generated.additionalLinks.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-2">Additional Links</h3>
              <div className="space-y-2">
                {generated.additionalLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    • {link.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCreatePrediction}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Create Forecast
            </button>
            <button
              onClick={handleTryAgain}
              className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
