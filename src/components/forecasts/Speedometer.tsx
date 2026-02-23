import { useMemo } from 'react'

interface SpeedometerProps {
  percentage: number
  label: string
  color: 'green' | 'red'
  size?: 'sm' | 'md' | 'lg'
}

export default function Speedometer({
  percentage,
  label,
  color,
  size = 'md',
}: SpeedometerProps) {
  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  const sizes = {
    sm: { width: 80, height: 50, strokeWidth: 6, fontSize: 'text-sm' },
    md: { width: 120, height: 70, strokeWidth: 8, fontSize: 'text-lg' },
    lg: { width: 160, height: 90, strokeWidth: 10, fontSize: 'text-xl' },
  }

  const { width, height, strokeWidth, fontSize } = sizes[size]

  // Calculate the arc path for the speedometer
  // The speedometer is a semi-circle from 180 to 360 degrees
  const radius = (width - strokeWidth) / 2
  const center = { x: width / 2, y: height - strokeWidth / 2 }

  // Calculate the needle angle (0% = 180°, 100% = 360°)
  const needleAngle = 180 + (clampedPercentage / 100) * 180
  const needleAngleRad = (needleAngle * Math.PI) / 180
  const needleLength = radius - strokeWidth
  const needleEnd = {
    x: center.x + needleLength * Math.cos(needleAngleRad),
    y: center.y + needleLength * Math.sin(needleAngleRad),
  }

  // Color configuration
  const colors = useMemo(() => {
    if (color === 'green') {
      return {
        arc: '#22c55e', // green-500
        arcBackground: '#dcfce7', // green-50
        needle: '#16a34a', // green-600
        text: '#16a34a', // green-600
      }
    } else {
      return {
        arc: '#ef4444', // red-500
        arcBackground: '#fee2e2', // red-50
        needle: '#dc2626', // red-600
        text: '#dc2626', // red-600
      }
    }
  }, [color])

  // Create the background arc (gray)
  const backgroundArc = createArcPath(center, radius, 180, 360)

  // Create the colored arc based on percentage
  const coloredArc = createArcPath(center, radius, 180, 180 + clampedPercentage * 1.8)

  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Background arc */}
        <path
          d={backgroundArc}
          fill="none"
          stroke={colors.arcBackground}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Colored arc */}
        <path
          d={coloredArc}
          fill="none"
          stroke={colors.arc}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />

        {/* Needle */}
        <line
          x1={center.x}
          y1={center.y}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke={colors.needle}
          strokeWidth={Math.max(2, strokeWidth / 3)}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />

        {/* Center pivot */}
        <circle
          cx={center.x}
          cy={center.y}
          r={strokeWidth / 2}
          fill={colors.needle}
        />

        {/* Percentage text */}
        <text
          x={width / 2}
          y={height / 2 + strokeWidth}
          textAnchor="middle"
          className={`${fontSize} font-bold fill-gray-700`}
          style={{ fontSize: size === 'sm' ? '14px' : size === 'md' ? '18px' : '24px' }}
        >
          {Math.round(clampedPercentage)}%
        </text>
      </svg>
      <p className={`mt-1 text-xs font-medium ${fontSize === 'text-sm' ? 'text-xs' : 'text-sm'} text-gray-500`}>
        {label}
      </p>
    </div>
  )
}

// Helper function to create an arc path
function createArcPath(
  center: { x: number; y: number },
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(center.x, center.y, radius, endAngle)
  const end = polarToCartesian(center.x, center.y, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(' ')
}

// Helper function to convert polar coordinates to cartesian
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}
