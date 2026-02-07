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

  // Color coding based on available CU
  const getColorClasses = () => {
    if (cuAvailable > 50) {
      return {
        text: 'text-green-600',
        bg: 'bg-green-100',
        border: 'border-green-300',
        progress: 'bg-green-500',
      }
    } else if (cuAvailable >= 10) {
      return {
        text: 'text-yellow-600',
        bg: 'bg-yellow-100',
        border: 'border-yellow-300',
        progress: 'bg-yellow-500',
      }
    } else {
      return {
        text: 'text-red-600',
        bg: 'bg-red-100',
        border: 'border-red-300',
        progress: 'bg-red-500',
      }
    }
  }

  const colors = getColorClasses()

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
      <div className="space-y-2">
        {/* Available CU - Prominent */}
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-gray-700">Available CU</span>
            <span className={`text-2xl font-bold ${colors.text}`}>{cuAvailable}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full ${colors.progress} transition-all duration-300`}
            style={{ width: `${availablePercentage}%` }}
          />
        </div>

        {/* Locked CU - Secondary */}
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-gray-600">Locked</span>
          <span className="font-medium text-gray-700">{cuLocked}</span>
        </div>

        {/* Total CU - Optional */}
        {showDetails && (
          <div className="border-t border-gray-300 pt-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-gray-700">Total CU</span>
              <span className="font-bold text-gray-900">{totalCU}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
