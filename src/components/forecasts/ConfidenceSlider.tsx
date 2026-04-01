'use client'

interface ConfidenceSliderProps {
  value: number
  onChange: (value: number) => void
  onCommit: () => void
  isSubmitting?: boolean
  disabled?: boolean
}

export default function ConfidenceSlider({
  value,
  onChange,
  onCommit,
  isSubmitting = false,
  disabled = false,
}: ConfidenceSliderProps) {
  // Derive label based on value
  const getLabel = (val: number) => {
    if (val === 0) return 'Neutral'
    if (val <= -90) return 'Almost sure NO'
    if (val <= -50) return 'Probably NO'
    if (val < 0) return 'Leaning NO'
    if (val >= 90) return 'Almost sure YES'
    if (val >= 50) return 'Probably YES'
    return 'Leaning YES'
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
            step="1"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
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

      <button
        onClick={onCommit}
        disabled={isNeutral || disabled || isSubmitting}
        className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-200 ${
          isNeutral || disabled || isSubmitting
            ? 'bg-navy-800 text-gray-600 cursor-not-allowed border border-navy-600'
            : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20 active:scale-[0.98] border border-blue-400/30'
        }`}
      >
        {isSubmitting ? 'Submitting...' : 'Commit Forecast'}
      </button>
    </div>
  )
}
