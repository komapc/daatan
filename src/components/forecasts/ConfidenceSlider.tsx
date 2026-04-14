'use client'

import { CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ConfidenceSliderProps {
  value: number
  onChange: (value: number) => void
  onCommit: () => void
  isSubmitting?: boolean
  disabled?: boolean
  canCommit?: boolean
  isCommitted?: boolean
}

export default function ConfidenceSlider({
  value,
  onChange,
  onCommit,
  isSubmitting = false,
  disabled = false,
  canCommit = true,
  isCommitted = false,
}: ConfidenceSliderProps) {
  const t = useTranslations('commitment.confidenceLabel')

  const getLabel = (val: number) => {
    if (val === 0) return t('neutral')
    if (val <= -90) return t('almostCertainNo')
    if (val <= -70) return t('veryLikelyNo')
    if (val <= -50) return t('probablyNo')
    if (val <= -30) return t('leaningNo')
    if (val < 0) return t('slightlyNo')
    if (val >= 90) return t('almostCertainYes')
    if (val >= 70) return t('veryLikelyYes')
    if (val >= 50) return t('probablyYes')
    if (val >= 30) return t('leaningYes')
    return t('slightlyYes')
  }

  const isNeutral = value === 0

  return (
    <div className="w-full space-y-6 py-4">
      <div className="space-y-4">
        <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-gray-500">
          <span className="text-red-400">100% NO</span>
          <span>Neutral</span>
          <span className="text-teal">100% YES</span>
        </div>
        
        <div className="relative group">
          <input
            type="range"
            min="-100"
            max="100"
            step="any"
            value={value}
            onChange={(e) => onChange(Math.round(parseFloat(e.target.value)))}
            disabled={disabled || isSubmitting}
            className="w-full h-3 bg-navy-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all border border-navy-600 shadow-inner"
          />
          {/* Zero mark */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-navy-600 -translate-x-1/2 pointer-events-none" />
        </div>
        
        <div className="text-center">
          <div className={`text-xl font-black uppercase tracking-tighter ${
            value > 0 ? 'text-teal' : value < 0 ? 'text-red-400' : 'text-gray-500'
          }`}>
            {getLabel(value)}
          </div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
            Confidence Score: {value > 0 ? '+' : ''}{value}
          </div>
        </div>
      </div>

      {isCommitted && !canCommit && !isSubmitting ? (
        <div className="flex items-center justify-center gap-2 py-4 px-4 bg-teal/10 border border-teal/30 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-teal" />
          <span className="text-sm font-bold text-teal uppercase tracking-widest">Your forecast is committed</span>
        </div>
      ) : (
        <button
          onClick={onCommit}
          disabled={isNeutral || disabled || isSubmitting || !canCommit}
          className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-200 ${
            isNeutral || disabled || isSubmitting || !canCommit
              ? 'bg-navy-800 text-gray-600 cursor-not-allowed border border-navy-600'
              : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20 active:scale-[0.98] border border-blue-400/30'
          }`}
        >
          {isSubmitting ? 'Submitting...' : 'Commit Forecast'}
        </button>
      )}
    </div>
  )
}
