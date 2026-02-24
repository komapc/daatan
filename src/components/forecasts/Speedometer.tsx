import { useMemo } from 'react'

interface SpeedometerProps {
  percentage: number
  label: string
  color: 'green' | 'red'
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export default function Speedometer({
  percentage,
  label,
  color,
  size = 'md',
}: SpeedometerProps) {
  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  // ∩-shape speedometer: height is roughly radius + top/bottom padding
  const sizes = {
    sm: { width: 120, height: 72, strokeWidth: 5, fontSize: '12px', needleBase: 5, pivotRadius: 3.5 },
    md: { width: 160, height: 96, strokeWidth: 7, fontSize: '15px', needleBase: 6, pivotRadius: 4.5 },
    lg: { width: 220, height: 132, strokeWidth: 9, fontSize: '18px', needleBase: 8, pivotRadius: 6 },
    xl: { width: 280, height: 168, strokeWidth: 11, fontSize: '24px', needleBase: 10, pivotRadius: 7.5 },
  }

  const { width, height, strokeWidth, fontSize, needleBase, pivotRadius } = sizes[size]

  // Center at bottom: arc arches upward (∩ shape)
  const bottomPad = strokeWidth + pivotRadius + 4
  const topPad = strokeWidth + 4
  const radius = Math.min(width / 2 - strokeWidth - 4, height - topPad - bottomPad)
  const center = { x: width / 2, y: height - bottomPad }

  // ∩-shape needle: 0% → 180° (9 o'clock), 50% → 270° (12 o'clock), 100% → 360° (3 o'clock)
  const needleAngleDeg = 180 + (clampedPercentage / 100) * 180
  const needleAngleRad = (needleAngleDeg * Math.PI) / 180
  const needleLength = radius - 2

  // Tapered needle: perpendicular offsets from the needle direction
  const perpAngleLeft = ((needleAngleDeg + 90) * Math.PI) / 180
  const perpAngleRight = ((needleAngleDeg - 90) * Math.PI) / 180

  const baseLeft = {
    x: center.x + (needleBase / 2) * Math.cos(perpAngleLeft),
    y: center.y + (needleBase / 2) * Math.sin(perpAngleLeft),
  }
  const baseRight = {
    x: center.x + (needleBase / 2) * Math.cos(perpAngleRight),
    y: center.y + (needleBase / 2) * Math.sin(perpAngleRight),
  }
  const tip = {
    x: center.x + needleLength * Math.cos(needleAngleRad),
    y: center.y + needleLength * Math.sin(needleAngleRad),
  }

  const needlePath = `M ${baseLeft.x} ${baseLeft.y} L ${tip.x} ${tip.y} L ${baseRight.x} ${baseRight.y} Z`

  const theme = useMemo(() => {
    return {
      greenGradientId: `arc-gradient-green-${size}`,
      redGradientId: `arc-gradient-red-${size}`,
      shadowId: `arc-shadow-${size}`,
      pivotGradientId: `pivot-gradient-${size}`,
      greenStart: 'hsl(142, 70%, 55%)',
      greenMiddle: 'hsl(142, 72%, 45%)',
      greenEnd: 'hsl(142, 76%, 36%)',
      redStart: 'hsl(0, 70%, 65%)',
      redMiddle: 'hsl(0, 72%, 55%)',
      redEnd: 'hsl(0, 84%, 44%)',
      grayBackground: 'hsl(210, 10%, 88%)',
      needle: '#1e293b',
      text: 'hsl(215, 25%, 20%)',
    }
  }, [size])

  // ∩-shape arcs: all use angles in [180°, 360°] going counter-clockwise (through 12 o'clock)
  // Using 360 instead of 0 ensures angleDiff > 0 → sweepFlag=0 (counter-clockwise = ∩)
  const backgroundArc = createArcPath(center, radius, 180, 360)
  const greenArc = createArcPath(center, radius, 180, needleAngleDeg)
  const redArc = createArcPath(center, radius, needleAngleDeg, 360)

  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-label={`${label}: ${clampedPercentage}%`}
      >
        <defs>
          <linearGradient id={theme.greenGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.greenStart} />
            <stop offset="50%" stopColor={theme.greenMiddle} />
            <stop offset="100%" stopColor={theme.greenEnd} />
          </linearGradient>

          <linearGradient id={theme.redGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.redStart} />
            <stop offset="50%" stopColor={theme.redMiddle} />
            <stop offset="100%" stopColor={theme.redEnd} />
          </linearGradient>

          <radialGradient id={theme.pivotGradientId} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff88" />
            <stop offset="70%" stopColor="#ffffff33" />
            <stop offset="100%" stopColor={theme.needle} />
          </radialGradient>

          <filter id={theme.shadowId} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Gray background track */}
        <path
          d={backgroundArc}
          fill="none"
          stroke={theme.grayBackground}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Green arc — Yes/Will Happen region (left side, 9→12 o'clock) */}
        <path
          d={greenArc}
          fill="none"
          stroke={`url(#${theme.greenGradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter={`url(#${theme.shadowId})`}
          className="transition-all duration-700 ease-in-out"
        />

        {/* Red arc — No/Won't Happen region (right side, 12→3 o'clock) */}
        <path
          d={redArc}
          fill="none"
          stroke={`url(#${theme.redGradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter={`url(#${theme.shadowId})`}
          className="transition-all duration-700 ease-in-out"
        />

        {/* Tapered needle */}
        <path
          d={needlePath}
          fill={theme.needle}
          filter={`url(#${theme.shadowId})`}
          className="transition-all duration-700 ease-in-out"
        />

        {/* Pivot point */}
        <circle
          cx={center.x}
          cy={center.y}
          r={pivotRadius}
          fill={`url(#${theme.pivotGradientId})`}
          stroke={theme.needle}
          strokeWidth="0.5"
        />

        {/* Percentage value — centered inside the arch */}
        <text
          x={center.x}
          y={center.y - radius * 0.42}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-black transition-all duration-500"
          style={{
            fontSize,
            fill: theme.text,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.03em',
          }}
        >
          {Math.round(clampedPercentage)}%
        </text>
      </svg>

      <span className="mt-1 text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-[0.15em] text-slate-500 text-center px-4 leading-tight">
        {label}
      </span>
    </div>
  )
}

/**
 * Create an SVG arc path from startAngle to endAngle.
 * Angles in degrees: 0°/360° = right (3 o'clock), 90° = down, 180° = left (9 o'clock), 270° = up (12 o'clock)
 *
 * For the ∩-shape speedometer all angles are in [180°, 360°]:
 *   angleDiff > 0 → sweepFlag=0 (counter-clockwise in SVG = arches upward through 270°)
 */
function createArcPath(
  center: { x: number; y: number },
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  if (Math.abs(startAngle - endAngle) < 0.5) return ''

  const start = polarToCartesian(center.x, center.y, radius, startAngle)
  const end = polarToCartesian(center.x, center.y, radius, endAngle)

  const angleDiff = endAngle - startAngle
  // For angles in [180°, 360°]: angleDiff is always positive (0–180°), so sweepFlag=0 (CCW = ∩)
  const largeArcFlag = Math.abs(angleDiff) > 180 ? 1 : 0
  const sweepFlag = angleDiff > 0 ? 0 : 1

  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, sweepFlag, end.x, end.y].join(' ')
}

/**
 * Convert polar coordinates (angle in degrees) to Cartesian (x, y).
 * Standard SVG: 0° = right, 90° = down, 180° = left, 270° = up
 */
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } {
  const angleInRadians = (angleInDegrees * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}
