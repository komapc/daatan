interface CUBalanceIndicatorProps {
  cuAvailable: number
  cuLocked: number
  showDetails?: boolean
}

export default function CUBalanceIndicator({
  cuAvailable,
  cuLocked,
  showDetails = false,
}: CUBalanceIndicatorProps) {
  const totalCU = cuAvailable + cuLocked
  const availablePercentage = totalCU > 0 ? (cuAvailable / totalCU) * 100 : 0

  // SVG ring config
  const radius = 34
  const stroke = 6
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (availablePercentage / 100) * circumference

  // Color coding based on available CU
  const getAccent = () => {
    if (cuAvailable > 50) return { ring: '#22c55e', text: 'text-green-600', bg: 'bg-green-50' }
    if (cuAvailable >= 10) return { ring: '#eab308', text: 'text-yellow-600', bg: 'bg-yellow-50' }
    return { ring: '#ef4444', text: 'text-red-600', bg: 'bg-red-50' }
  }

  const accent = getAccent()

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-5">
        {/* Ring gauge */}
        <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
          <svg width="80" height="80" className="-rotate-90">
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={stroke}
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke={accent.ring}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-500"
            />
          </svg>
          <span
            className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${accent.text}`}
          >
            {cuAvailable}
          </span>
        </div>

        {/* Labels */}
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Available CU</p>
            <p className={`text-2xl font-extrabold leading-tight ${accent.text}`}>{cuAvailable}</p>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
              <span>Locked <span className="font-semibold text-gray-700">{cuLocked}</span></span>
            </div>
            {showDetails && (
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />
                <span>Total <span className="font-semibold text-gray-700">{totalCU}</span></span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
