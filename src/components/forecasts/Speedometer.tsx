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
    sm: { width: 60, height: 40, strokeWidth: 4, fontSize: '11px', needleBase: 3 },
    md: { width: 80, height: 50, strokeWidth: 5, fontSize: '13px', needleBase: 4 },
    lg: { width: 100, height: 65, strokeWidth: 6, fontSize: '15px', needleBase: 5 },
  }

  const { width, height, strokeWidth, fontSize, needleBase } = sizes[size]

  // Calculate the arc path for the speedometer
  const radius = (width - strokeWidth) / 2
  const center = { x: width / 2, y: height - strokeWidth / 2 }

  // Needle angle (0% = 180°, 100% = 360°)
  const needleAngle = 180 + (clampedPercentage / 100) * 180
  const needleAngleRad = (needleAngle * Math.PI) / 180
  const needleLength = radius - 2 // Leave a tiny gap at the end

  // Tapered needle calculation
  // Base of the needle is at the center pivot
  const needleAngleLeftRad = ((needleAngle - 90) * Math.PI) / 180
  const needleAngleRightRad = ((needleAngle + 90) * Math.PI) / 180

  const baseLeft = {
    x: center.x + (needleBase / 2) * Math.cos(needleAngleLeftRad),
    y: center.y + (needleBase / 2) * Math.sin(needleAngleLeftRad),
  }
  const baseRight = {
    x: center.x + (needleBase / 2) * Math.cos(needleAngleRightRad),
    y: center.y + (needleBase / 2) * Math.sin(needleAngleRightRad),
  }
  const tip = {
    x: center.x + needleLength * Math.cos(needleAngleRad),
    y: center.y + needleLength * Math.sin(needleAngleRad),
  }

  const needlePath = `M ${baseLeft.x} ${baseLeft.y} L ${tip.x} ${tip.y} L ${baseRight.x} ${baseRight.y} Z`

  // Theme configuration using HSL for vibrant gradients
  const theme = useMemo(() => {
    const isGreen = color === 'green'
    return {
      gradientId: `arc-gradient-${color}`,
      shadowId: `arc-shadow-${color}`,
      pivotGradientId: `pivot-gradient-${color}`,
      startColor: isGreen ? 'hsl(142, 70%, 45%)' : 'hsl(0, 70%, 55%)',
      endColor: isGreen ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 44%)',
      background: isGreen ? 'hsl(142, 70%, 95%)' : 'hsl(0, 70%, 97%)',
      needle: isGreen ? 'hsl(142, 76%, 30%)' : 'hsl(0, 84%, 40%)',
      text: 'hsl(215, 25%, 27%)', // Slate-800 for readability
    }
  }, [color])

  const backgroundArc = createArcPath(center, radius, 180, 360)
  const coloredArc = createArcPath(center, radius, 180, 180 + clampedPercentage * 1.8)

  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-label={`${label}: ${clampedPercentage}%`}
      >
        <defs>
          {/* Main arc gradient */}
          <linearGradient id={theme.gradientId} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor={theme.startColor} />
            <stop offset="100%" stopColor={theme.endColor} />
          </linearGradient>

          {/* Pivot metallic gradient */}
          <radialGradient id={theme.pivotGradientId} cx="30%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#ffffff66" />
            <stop offset="100%" stopColor={theme.needle} />
          </radialGradient>

          {/* Depth filter */}
          <filter id={theme.shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Gray Track */}
        <path
          d={backgroundArc}
          fill="none"
          stroke={theme.background}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Progress Arc */}
        <path
          d={coloredArc}
          fill="none"
          stroke={`url(#${theme.gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter={`url(#${theme.shadowId})`}
          className="transition-all duration-700 ease-in-out"
        />

        {/* Tapered Needle */}
        <path
          d={needlePath}
          fill={theme.needle}
          filter={`url(#${theme.shadowId})`}
          className="transition-all duration-700 ease-in-out origin-center"
          style={{ transformOrigin: `${center.x}px ${center.y}px` }}
        />

        {/* Pivot Point */}
        <circle
          cx={center.x}
          cy={center.y}
          r={needleBase / 1.5}
          fill={`url(#${theme.pivotGradientId})`}
          stroke={theme.needle}
          strokeWidth="0.5"
        />

        {/* Value Display */}
        <text
          x={center.x}
          y={center.y - radius * 0.45}
          textAnchor="middle"
          className="font-black fill-slate-800 transition-all duration-500"
          style={{
            fontSize,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em'
          }}
        >
          {Math.round(clampedPercentage)}%
        </text>
      </svg>

      {/* Label */}
      <span className="mt-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500/80">
        {label}
      </span>
    </div>
  )
}

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

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } {
  // SVG 0 degrees is 3 o'clock. We want 0% to be 9 o'clock (180 deg) and 100% to be 3 o'clock (0 deg).
  // Our logic uses 180 deg as 0% and 360 deg as 100%.
  // In our polarToCartesian, we subtract 90 from degrees which is a common convention but let's adjust for our specific arc:
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}
