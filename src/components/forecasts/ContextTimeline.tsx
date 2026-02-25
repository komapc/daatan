'use client'

import { useEffect, useState } from 'react'
import { FileText, RefreshCw, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('ContextTimeline')

type Source = {
  title: string
  url: string
  source?: string | null
  publishedDate?: string | null
}

type Snapshot = {
  id: string
  summary: string
  sources: Source[]
  createdAt: string
}

type Props = {
  predictionId: string
  initialContext?: string | null
  initialContextUpdatedAt?: string | null
  canAnalyze: boolean
}

export default function ContextTimeline({
  predictionId,
  initialContext,
  initialContextUpdatedAt,
  canAnalyze,
}: Props) {
  const [currentContext, setCurrentContext] = useState(initialContext || null)
  const [contextUpdatedAt, setContextUpdatedAt] = useState(initialContextUpdatedAt || null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isTimelineOpen, setIsTimelineOpen] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)

  // Fetch timeline on mount
  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await fetch(`/api/forecasts/${predictionId}/context`)
        if (res.ok) {
          const data = await res.json()
          setCurrentContext(data.currentContext)
          setContextUpdatedAt(data.contextUpdatedAt)
          setSnapshots(data.snapshots || [])
        }
      } catch (err) {
        log.error({ err }, 'Failed to fetch context timeline')
      } finally {
        setHasFetched(true)
      }
    }
    fetchTimeline()
  }, [predictionId])

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    toast.loading('Analyzing latest news...', { id: 'analyze' })
    try {
      const res = await fetch(`/api/forecasts/${predictionId}/context`, {
        method: 'POST',
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to analyze context (${res.status})`)
      }
      const data = await res.json()
      setCurrentContext(data.newContext)
      setContextUpdatedAt(data.contextUpdatedAt)
      setSnapshots(data.timeline || [])
      toast.success('Context updated!', { id: 'analyze', duration: 3000 })
    } catch (e: any) {
      log.error({ err: e }, 'Failed to analyze context')
      toast.error(e.message || 'Failed to analyze context', { id: 'analyze' })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const previousSnapshots = snapshots.slice(1)

  // Don't render section at all if no context and user can't analyze
  if (!currentContext && !canAnalyze && hasFetched) {
    return null
  }

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Situation Context
        </h2>
        {canAnalyze && (
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Analyze Situation
          </button>
        )}
      </div>

      {/* Current context card */}
      {currentContext && (
        <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
          <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{currentContext}</p>
          {contextUpdatedAt && (
            <p className="text-xs text-gray-400 mt-2">
              Last updated: {formatDate(contextUpdatedAt)}
            </p>
          )}
          {/* Sources from latest snapshot */}
          {snapshots[0]?.sources && (snapshots[0].sources as Source[]).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Sources</p>
              <div className="flex flex-wrap gap-2">
                {(snapshots[0].sources as Source[]).map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {src.source || src.title}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previous updates toggle */}
      {previousSnapshots.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setIsTimelineOpen(!isTimelineOpen)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {isTimelineOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {previousSnapshots.length} previous update{previousSnapshots.length !== 1 ? 's' : ''}
          </button>

          {/* Collapsible timeline */}
          {isTimelineOpen && (
            <div className="mt-3 ml-2 border-l-2 border-gray-200 pl-4 space-y-4">
              {previousSnapshots.map((snap) => (
                <div key={snap.id} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-gray-300 border-2 border-white" />
                  <div className="text-xs text-gray-400 mb-1">
                    {formatDate(snap.createdAt)}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{snap.summary}</p>
                  {/* Sources */}
                  {(snap.sources as Source[])?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(snap.sources as Source[]).map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700 hover:underline"
                        >
                          {src.source || src.title}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
