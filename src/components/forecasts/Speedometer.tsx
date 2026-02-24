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

  const sizes = {
    sm: { width: 120, height: 75, strokeWidth: 5, fontSize: '12px', needleBase: 5, pivotRadius: 3.5 },
    md: { width: 160, height: 100, strokeWidth: 7, fontSize: '15px', needleBase: 6, pivotRadius: 4.5 },
    lg: { width: 220, height: 140, strokeWidth: 9, fontSize: '18px', needleBase: 8, pivotRadius: 6 },
    xl: { width: 280, height: 180, strokeWidth: 11, fontSize: '24px', needleBase: 10, pivotRadius: 7.5 },
  }

  const { width, height, strokeWidth, fontSize, needleBase, pivotRadius } = sizes[size]

  // Center positioned so arc fits within viewBox with room for labels below
  const radius = Math.min((width / 2) - strokeWidth - 4, height - strokeWidth - 20)
  const center = { x: width / 2, y: height - (strokeWidth + 8) }

  // Standard speedometer: 0% at 180° (9 o'clock), 100% at 0° (3 o'clock)
  // angle = 180 - (percentage / 100) * 180
  const needleAngleDeg = 180 - (clampedPercentage / 100) * 180
  const needleAngleRad = (needleAngleDeg * Math.PI) / 180
  const needleLength = radius - 2

  // Tapered needle: perpendicular offsets from the needle angle
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

  // Theme configuration using HSL for vibrant gradients
  // Always use green+red split, regardless of color prop
  const theme = useMemo(() => {
    return {
      greenGradientId: `arc-gradient-green-${size}`,
      redGradientId: `arc-gradient-red-${size}`,
      shadowId: `arc-shadow-${size}`,
      pivotGradientId: `pivot-gradient-${size}`,
      // Green (Yes/Will Happen)
      greenStart: 'hsl(142, 70%, 55%)',
      greenMiddle: 'hsl(142, 72%, 45%)',
      greenEnd: 'hsl(142, 76%, 36%)',
      // Red (No/Won't Happen)
      redStart: 'hsl(0, 70%, 65%)',
      redMiddle: 'hsl(0, 72%, 55%)',
      redEnd: 'hsl(0, 84%, 44%)',
      // Backgrounds
      grayBackground: 'hsl(210, 10%, 88%)',
      // Needle: dark neutral color for visibility against both green and red
      needle: '#1e293b',
      text: 'hsl(215, 25%, 20%)',
    }
  }, [size])

  // Arc from 180° (9 o'clock) to 0° (3 o'clock)
  const backgroundArc = createArcPath(center, radius, 180, 0)
  // Green arc: 180° to needle (yes region)
  const greenArc = createArcPath(center, radius, 180, needleAngleDeg)
  // Red arc: needle to 0° (no region)
  const redArc = createArcPath(center, radius, needleAngleDeg, 0)

  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-hidden"
        aria-label={`${label}: ${clampedPercentage}%`}
      >
        <defs>
          {/* Green gradient - Yes region (left side) */}
          <linearGradient id={theme.greenGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.greenStart} />
            <stop offset="50%" stopColor={theme.greenMiddle} />
            <stop offset="100%" stopColor={theme.greenEnd} />
          </linearGradient>

          {/* Red gradient - No region (right side) */}
          <linearGradient id={theme.redGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.redStart} />
            <stop offset="50%" stopColor={theme.redMiddle} />
            <stop offset="100%" stopColor={theme.redEnd} />
          </linearGradient>

          {/* Pivot metallic gradient - scales with needleBase */}
          <radialGradient id={theme.pivotGradientId} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff88" />
            <stop offset="70%" stopColor="#ffffff33" />
            <stop offset="100%" stopColor={theme.needle} />
          </radialGradient>

          {/* Depth filter */}
          <filter id={theme.shadowId} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Gray Background Track (9 o'clock to 3 o'clock) */}
        <path
          d={backgroundArc}
          fill="none"
          stroke={theme.grayBackground}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Green Arc - Yes/Will Happen region (needle splits green from red) */}
        <path
          d={greenArc}
          fill="none"
          stroke={`url(#${theme.greenGradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          filter={`url(#${theme.shadowId})`}
          className="transition-all duration-700 ease-in-out"
        />

        {/* Red Arc - No/Won't Happen region */}
        <path
          d={redArc}
          fill="none"
          stroke={`url(#${theme.redGradientId})`}
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
          className="transition-all duration-700 ease-in-out"
        />

        {/* Pivot Point (metallic 3D effect) */}
        <circle
          cx={center.x}
          cy={center.y}
          r={pivotRadius}
          fill={`url(#${theme.pivotGradientId})`}
          stroke={theme.needle}
          strokeWidth="0.5"
        />

        {/* Value Display - Centered in the gauge */}
        <text
          x={center.x}
          y={center.y - radius * 0.35}
          textAnchor="middle"
          className="font-black transition-all duration-500"
          style={{
            fontSize,
            fill: theme.text,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.03em',
            textShadow: '0px 1px 2px rgba(255,255,255,0.9)',
          }}
        >
          {Math.round(clampedPercentage)}%
        </text>
      </svg>

      {/* Label - Properly spaced below with adequate padding */}
      <span className="mt-3 text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-[0.15em] text-slate-500 text-center px-4 leading-tight">
        {label}
      </span>
    </div>
  )
}

/**
 * Create an SVG arc path from startAngle to endAngle
 * Angles in degrees: 0° = right (3 o'clock), 90° = down, 180° = left (9 o'clock), 270° = up
 * Arc is drawn clockwise from start to end
 */
function createArcPath(
  center: { x: number; y: number },
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(center.x, center.y, radius, startAngle)
  const end = polarToCartesian(center.x, center.y, radius, endAngle)

  // Calculate the angular sweep
  let angleDiff = endAngle - startAngle

  // Normalize to -180 to 180 range for cleaner arc calculation
  if (angleDiff > 180) {
    angleDiff -= 360
  } else if (angleDiff < -180) {
    angleDiff += 360
  }

  // largeArcFlag: 1 if arc > 180°, 0 if arc ≤ 180°
  const largeArcFlag = Math.abs(angleDiff) > 180 ? 1 : 0
  // sweepFlag: 1 for clockwise, 0 for counter-clockwise
  const sweepFlag = angleDiff < 0 ? 1 : 0

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, sweepFlag, end.x, end.y
  ].join(' ')
}

/**
 * Convert polar coordinates (angle in degrees) to Cartesian (x, y)
 * Standard SVG coordinates: 0° = right (3 o'clock), 90° = down, 180° = left, 270° = up
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
