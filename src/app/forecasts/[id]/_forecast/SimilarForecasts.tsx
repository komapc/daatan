'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Layers } from 'lucide-react'

interface SimilarForecast {
  id: string
  slug: string | null
  claimText: string
  status: string
  resolveByDatetime: string
  author: { name: string | null; username: string | null }
}

interface Props {
  predictionId: string
}

export function SimilarForecasts({ predictionId }: Props) {
  const [items, setItems] = useState<SimilarForecast[]>([])

  useEffect(() => {
    fetch(`/api/forecasts/similar?id=${predictionId}&limit=3`)
      .then(r => r.ok ? r.json() : { similar: [] })
      .then(data => setItems(data.similar ?? []))
      .catch(() => {})
  }, [predictionId])

  if (items.length === 0) return null

  return (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Layers className="w-4 h-4" />
        See also
      </h3>
      <div className="space-y-2">
        {items.map(item => (
          <Link
            key={item.id}
            href={`/forecasts/${item.slug || item.id}`}
            className="block p-3 rounded-lg border border-navy-600 bg-navy-700 hover:border-blue-500/50 hover:bg-navy-600 transition-colors"
          >
            <p className="text-sm text-white line-clamp-2">{item.claimText}</p>
            <p className="text-xs text-gray-500 mt-1">
              {item.author.name || item.author.username || 'Anonymous'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
