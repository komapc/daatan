'use client'

import { useState, useEffect } from 'react'
import { Link as LinkIcon, Search, X, ExternalLink, Loader2, Wand2 } from 'lucide-react'
import type { PredictionFormData } from '../ForecastWizard'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('StepNewsAnchor')

type Props = {
  formData: PredictionFormData
  updateFormData: (updates: Partial<PredictionFormData>) => void
}

type NewsAnchor = {
  id: string
  url: string
  title: string
  source?: string
  imageUrl?: string
  _count: { predictions: number }
}

export const StepNewsAnchor = ({ formData, updateFormData }: Props) => {
  const [url, setUrl] = useState(formData.newsAnchorUrl || '')
  const [title, setTitle] = useState(formData.newsAnchorTitle || '')
  const [isSearching, setIsSearching] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [searchResults, setSearchResults] = useState<NewsAnchor[]>([])
  const [selectedAnchor, setSelectedAnchor] = useState<NewsAnchor | null>(null)

  const isUrl = /^https?:\/\/[^\s]+$/i.test(url.trim())

  // Auto-fetch title when URL is pasted
  useEffect(() => {
    const fetchTitle = async () => {
      if (isUrl && !title && !isSearching && !isExtracting) {
        setIsSearching(true)
        try {
          const response = await fetch(`/api/news-anchors?url=${encodeURIComponent(url.trim())}`)
          if (response.ok) {
            const data = await response.json()
            const existingAnchor = data.anchors?.[0]
            if (existingAnchor) {
              setTitle(existingAnchor.title)
              handleSelectAnchor(existingAnchor)
            } else if (!title) {
              // Extract a basic title from the URL path as a last resort
              try {
                const urlObj = new URL(url.trim())
                const pathParts = urlObj.pathname.split('/').filter(Boolean)
                if (pathParts.length > 0) {
                  const lastPart = pathParts[pathParts.length - 1]
                  const readableTitle = lastPart
                    .replace(/[-_]/g, ' ')
                    .replace(/\.[^/.]+$/, '') // remove extension
                    .replace(/\b\w/g, l => l.toUpperCase()) // capitalize
                  if (readableTitle.length > 5) setTitle(readableTitle)
                }
              } catch {
                // ignore
              }
            }
          }
        } catch (error) {
          log.warn({ err: error }, 'Failed to fetch article title')
        } finally {
          setIsSearching(false)
        }
      }
    }

    const timer = setTimeout(fetchTitle, 500)
    return () => clearTimeout(timer)
  }, [url, isUrl, title, isSearching, isExtracting])

  const handleUrlSubmit = async () => {
    if (!url) return

    setIsSearching(true)
    try {
      // Check if anchor exists or create new one
      const response = await fetch('/api/news-anchors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: title || 'Untitled Article',
        }),
      })

      if (response.ok) {
        const anchor = await response.json()
        setSelectedAnchor(anchor)
        updateFormData({
          newsAnchorId: anchor.id,
          newsAnchorUrl: anchor.url,
          newsAnchorTitle: anchor.title,
        })
      }
    } catch (error) {
      log.error({ err: error }, 'Error creating news anchor')
    } finally {
      setIsSearching(false)
    }
  }

  const handleMagicExtract = async () => {
    if (!url) return

    setIsExtracting(true)
    try {
      // First, ensure the news anchor exists
      const anchorResponse = await fetch('/api/news-anchors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: title || 'Untitled Article',
        }),
      })

      let anchorId: string | undefined
      if (anchorResponse.ok) {
        const anchor = await anchorResponse.json()
        anchorId = anchor.id
        setSelectedAnchor(anchor)
      }

      // Now call AI extraction
      const aiResponse = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (aiResponse.ok) {
        const data = await aiResponse.json()
        updateFormData({
          newsAnchorId: anchorId,
          newsAnchorUrl: url,
          newsAnchorTitle: title || data.claim.substring(0, 50),
          claimText: data.claim,
          resolveByDatetime: data.resolutionDate,
          outcomeType: data.outcomeOptions?.length > 2 ? 'MULTIPLE_CHOICE' : 'BINARY',
          outcomeOptions: data.outcomeOptions,
        })
      }
    } catch (error) {
      log.error({ err: error }, 'Magic extract error')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleSearch = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([])
      return
    }

    try {
      const response = await fetch(`/api/news-anchors?search=${encodeURIComponent(query)}&limit=5`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.anchors)
      }
    } catch (error) {
      log.error({ err: error }, 'Error searching news anchors')
    }
  }

  const handleSelectAnchor = (anchor: NewsAnchor) => {
    setSelectedAnchor(anchor)
    setUrl(anchor.url)
    setTitle(anchor.title)
    updateFormData({
      newsAnchorId: anchor.id,
      newsAnchorUrl: anchor.url,
      newsAnchorTitle: anchor.title,
    })
    setSearchResults([])
  }

  const handleClear = () => {
    setSelectedAnchor(null)
    setUrl('')
    setTitle('')
    updateFormData({
      newsAnchorId: undefined,
      newsAnchorUrl: undefined,
      newsAnchorTitle: undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Select News Anchor
        </h2>
        <p className="text-gray-500">
          Link your prediction to a specific news story or event. This provides context and helps with resolution.
        </p>
      </div>

      {selectedAnchor ? (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{selectedAnchor.title}</h3>
              <a
                href={selectedAnchor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
              >
                {selectedAnchor.source || new URL(selectedAnchor.url).hostname}
                <ExternalLink className="w-3 h-3" />
              </a>
              {selectedAnchor._count.predictions > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {selectedAnchor._count.predictions} prediction{selectedAnchor._count.predictions > 1 ? 's' : ''} linked
                </p>
              )}
            </div>
            <button
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label="Remove anchor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Search existing anchors */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search existing articles
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title..."
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {searchResults.length > 0 && (
              <ul className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100">
                {searchResults.map((anchor) => (
                  <li key={anchor.id}>
                    <button
                      onClick={() => handleSelectAnchor(anchor)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{anchor.title}</div>
                      <div className="text-sm text-gray-500">{anchor.source || new URL(anchor.url).hostname}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-sm text-gray-400">or add new</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* Add new anchor */}
          <div className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                Article URL
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isUrl ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'}`}
                />
              </div>
            </div>

            <div className={`transition-all duration-300 origin-top ${isUrl ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden'}`}>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Article Title
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isSearching ? 'Fetching title...' : 'Enter article headline'}
                  disabled={isSearching}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleMagicExtract}
                disabled={!isUrl || isSearching || isExtracting}
                className="flex-[2] py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                {isExtracting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    <span>AI Magic Extract</span>
                  </>
                )}
              </button>

              <button
                onClick={handleUrlSubmit}
                disabled={!isUrl || !title || isSearching || isExtracting}
                className="flex-1 py-3.5 px-6 rounded-xl bg-white text-gray-700 font-semibold border-2 border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Add Manually
              </button>
            </div>
          </div>
        </>
      )}

      <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
          <Wand2 className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-medium text-blue-900 text-sm">AI Magic Extract</h4>
          <p className="text-sm text-blue-700 mt-0.5">
            Paste a URL and click Magic Extract. We&apos;ll automatically identify the prediction, resolution date, and options for you.
          </p>
        </div>
      </div>
    </div>
  )
}

