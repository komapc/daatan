'use client'
import { ExternalLink } from 'lucide-react'
import type { Prediction } from './types'

interface Props {
  prediction: Prediction
  formatDate: (date: string | Date) => string
}

export function ResolutionInfo({ prediction, formatDate }: Props) {
  if (!prediction.resolvedAt) return null
  return (
    <div className="p-4 bg-cobalt/10 border border-cobalt/30 rounded-lg mb-8">
      <h3 className="font-semibold text-cobalt-light mb-2">Resolution</h3>
      <p className="text-cobalt-light mb-2">
        Resolved as{' '}
        <strong className={prediction.resolutionOutcome === 'wrong' ? 'text-red-600' : undefined}>
          {prediction.resolutionOutcome}
        </strong>{' '}
        on {formatDate(prediction.resolvedAt)}
      </p>
      {prediction.resolutionNote && (
        <p className="text-sm text-blue-600">{prediction.resolutionNote}</p>
      )}
      {prediction.evidenceLinks && prediction.evidenceLinks.length > 0 && (
        <div className="mt-3">
          <div className="text-sm font-medium text-cobalt-light mb-1">Evidence:</div>
          <ul className="space-y-1">
            {prediction.evidenceLinks.map((link, i) => (
              <li key={i}>
                <a href={link} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  {link}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
