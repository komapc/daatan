import type { CalibrationPoint } from '@/lib/services/profile'

interface CalibrationChartProps {
  calibration: CalibrationPoint[]
}

const W = 280
const H = 200
const PAD = { top: 12, right: 16, bottom: 36, left: 40 }
const PW = W - PAD.left - PAD.right
const PH = H - PAD.top - PAD.bottom

function cx(p: number) {
  return PAD.left + p * PW
}
function cy(p: number) {
  return PAD.top + (1 - p) * PH
}

export function CalibrationChart({ calibration }: CalibrationChartProps) {
  if (calibration.length < 2) {
    return (
      <p className="text-xs text-gray-500 py-4 text-center">
        Not enough resolved forecasts with probability inputs to plot calibration.
      </p>
    )
  }

  const sorted = [...calibration].sort((a, b) => a.predicted - b.predicted)
  const linePath = sorted
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${cx(pt.predicted).toFixed(1)} ${cy(pt.actual).toFixed(1)}`)
    .join(' ')

  const maxCount = Math.max(...calibration.map(p => p.count))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ maxHeight: 200 }}
      aria-label="Calibration curve"
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <g key={t}>
          <line
            x1={cx(0)} y1={cy(t)} x2={cx(1)} y2={cy(t)}
            stroke="#1e2d4a" strokeWidth="1"
          />
          <line
            x1={cx(t)} y1={cy(0)} x2={cx(t)} y2={cy(1)}
            stroke="#1e2d4a" strokeWidth="1"
          />
        </g>
      ))}

      {/* Perfect calibration diagonal */}
      <line
        x1={cx(0)} y1={cy(0)} x2={cx(1)} y2={cy(1)}
        stroke="#4b5563" strokeWidth="1.5" strokeDasharray="4 3"
      />

      {/* User calibration line */}
      <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />

      {/* Data points */}
      {calibration.map((pt, i) => {
        const r = 3 + (pt.count / maxCount) * 4
        return (
          <circle
            key={i}
            cx={cx(pt.predicted)}
            cy={cy(pt.actual)}
            r={r}
            fill="#3b82f6"
            fillOpacity="0.85"
            stroke="#1e3a5f"
            strokeWidth="1"
          >
            <title>{`Predicted: ${Math.round(pt.predicted * 100)}% · Actual: ${Math.round(pt.actual * 100)}% · ${pt.count} forecast${pt.count !== 1 ? 's' : ''}`}</title>
          </circle>
        )
      })}

      {/* X axis */}
      <line x1={cx(0)} y1={cy(0)} x2={cx(1)} y2={cy(0)} stroke="#374151" strokeWidth="1" />
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <text key={t} x={cx(t)} y={cy(0) + 14} textAnchor="middle" fontSize="9" fill="#6b7280">
          {Math.round(t * 100)}%
        </text>
      ))}
      <text x={cx(0.5)} y={H - 2} textAnchor="middle" fontSize="9" fill="#6b7280">
        Predicted
      </text>

      {/* Y axis */}
      <line x1={cx(0)} y1={cy(0)} x2={cx(0)} y2={cy(1)} stroke="#374151" strokeWidth="1" />
      {[0, 0.5, 1].map(t => (
        <text key={t} x={cx(0) - 6} y={cy(t) + 3.5} textAnchor="end" fontSize="9" fill="#6b7280">
          {Math.round(t * 100)}%
        </text>
      ))}
    </svg>
  )
}
