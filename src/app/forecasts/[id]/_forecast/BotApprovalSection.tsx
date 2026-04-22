'use client'
import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Prediction } from './types'

interface Props {
  prediction: Prediction
  isApproving: boolean
  onApprove: (status: 'ACTIVE' | 'VOID') => void
}

export function BotApprovalSection({ prediction, isApproving, onApprove }: Props) {
  const t = useTranslations('forecast')
  return (
    <div className="mb-8 p-5 bg-amber-900/20 border border-amber-700/40 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-5 h-5 text-amber-600" />
        <h3 className="text-lg font-semibold text-amber-900">{t('pendingApproval')}</h3>
      </div>
      <p className="text-sm text-amber-400 mb-4">{t('botPendingDescription')}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onApprove('ACTIVE')}
          disabled={isApproving}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isApproving ? t('approving') : t('approve')}
        </button>
        <button
          onClick={() => onApprove('VOID')}
          disabled={isApproving}
          className="flex items-center gap-1.5 px-4 py-2 bg-navy-700 border border-red-800/50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-900/20 disabled:opacity-50 transition-colors"
        >
          {t('reject')}
        </button>
      </div>
      {(prediction.sentiment || prediction.confidence != null || prediction.consensusLine) && (
        <div className="mt-3 p-3 bg-cobalt/10 border border-indigo-100 rounded-lg space-y-1.5 text-sm">
          {prediction.sentiment && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-indigo-900">Sentiment:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                prediction.sentiment === 'positive' ? 'bg-green-100 text-teal' :
                prediction.sentiment === 'negative' ? 'bg-red-100 text-red-400' :
                'bg-navy-700 text-text-secondary'
              }`}>
                {prediction.sentiment}
              </span>
            </div>
          )}
          {prediction.confidence != null && (
            <div className="text-indigo-900">Confidence: <span className="font-medium">{prediction.confidence}%</span></div>
          )}
          {prediction.consensusLine && (
            <p className="italic text-gray-300">&quot;{prediction.consensusLine}&quot;</p>
          )}
          {prediction.extractedEntities && prediction.extractedEntities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {prediction.extractedEntities.map((entity, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  {entity}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
