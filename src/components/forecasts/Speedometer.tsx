import { useMemo, useState, useCallback } from 'react'

interface SpeedometerProps {
  percentage?: number // Market average (default needle)
  userPercentage?: number // Thick interactive needle
  aiPercentage?: number // AI mark
  label?: string
  color?: 'green' | 'red'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  onUserPercentageChange?: (pct: number) => void
}

export default function Speedometer({
  percentage = 50,
  userPercentage,
  aiPercentage,
  label,
  color = 'green',
  size = 'md',
  onUserPercentageChange,
}: SpeedometerProps) {
  const safeMarketPct = isNaN(percentage) ? 50 : Math.min(100, Math.max(0, percentage))
  
  const sizes = {
    xs: { width: 64, height: 40, strokeWidth: 4, fontSize: '10px', needleBase: 3.5, pivotRadius: 2.5 },
    sm: { width: 120, height: 72, strokeWidth: 5, fontSize: '12px', needleBase: 5, pivotRadius: 3.5 },
    md: { width: 160, height: 96, strokeWidth: 7, fontSize: '15px', needleBase: 6, pivotRadius: 4.5 },
    lg: { width: 220, height: 132, strokeWidth: 9, fontSize: '18px', needleBase: 8, pivotRadius: 6 },
    xl: { width: 280, height: 168, strokeWidth: 11, fontSize: '24px', needleBase: 10, pivotRadius: 7.5 },
  }

  const { width, height, strokeWidth, fontSize, needleBase, pivotRadius } = sizes[size]

  const [isDragging, setIsDragging] = useState(false)

  const bottomPad = strokeWidth + pivotRadius + 4
  const topPad = strokeWidth + 4
  const radius = Math.min(width / 2 - strokeWidth - 4, height - topPad - bottomPad)
  const center = { x: width / 2, y: height - bottomPad }

  const getTickEnds = (pct: number) => {
    const angleDeg = 180 + (pct / 100) * 180
    const angleRad = (angleDeg * Math.PI) / 180
    const half = strokeWidth / 2 + 2
    return {
      x1: center.x + (radius - half) * Math.cos(angleRad),
      y1: center.y + (radius - half) * Math.sin(angleRad),
      x2: center.x + (radius + half) * Math.cos(angleRad),
      y2: center.y + (radius + half) * Math.sin(angleRad),
    }
  }

  const getNeedlePath = (pct: number, baseWidth: number, isThick: boolean = false) => {
    const angleDeg = 180 + (pct / 100) * 180
    const angleRad = (angleDeg * Math.PI) / 180
    const length = isThick ? radius - 4 : radius - 2
    
    const perpAngleLeft = ((angleDeg + 90) * Math.PI) / 180
    const perpAngleRight = ((angleDeg - 90) * Math.PI) / 180

    const bLeft = {
      x: center.x + (baseWidth / 2) * Math.cos(perpAngleLeft),
      y: center.y + (baseWidth / 2) * Math.sin(perpAngleLeft),
    }
    const bRight = {
      x: center.x + (baseWidth / 2) * Math.cos(perpAngleRight),
      y: center.y + (baseWidth / 2) * Math.sin(perpAngleRight),
    }
    const tip = {
      x: center.x + length * Math.cos(angleRad),
      y: center.y + length * Math.sin(angleRad),
    }

    return `M ${bLeft.x} ${bLeft.y} L ${tip.x} ${tip.y} L ${bRight.x} ${bRight.y} Z`
  }

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
      grayBackground: '#1C3A5A',
      needleMarket: '#A0AEC0',
      needleUser: '#3B82F6', // Blue-500
      needleAI: '#FBBF24', // Amber-400
      text: '#E6E9EF',
    }
  }, [size])

  const getPctFromPointer = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY
    const dx = mx - center.x
    const dy = my - center.y
    let deg = Math.atan2(dy, dx) * 180 / Math.PI
    if (deg < 0) deg += 360
    // Arc: 180° (left, 0%) → 270° (top, 50%) → 360° (right, 100%)
    // Angles 0..90 are upper-right → clamp to 100; 90..180 are upper-left → clamp to 0
    if (deg < 90) return 100
    if (deg < 180) return 0
    return (deg - 180) / 180 * 100
  }, [center.x, center.y, width, height])

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!onUserPercentageChange || userPercentage === undefined) return
    e.preventDefault()
    ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
    setIsDragging(true)
    onUserPercentageChange(getPctFromPointer(e))
  }, [onUserPercentageChange, userPercentage, getPctFromPointer])

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || !onUserPercentageChange) return
    onUserPercentageChange(getPctFromPointer(e))
  }, [isDragging, onUserPercentageChange, getPctFromPointer])

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) return
    ;(e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId)
    setIsDragging(false)
  }, [isDragging])

  const backgroundArc = createArcPath(center, radius, 180, 360)
  const greenArc = createArcPath(center, radius, 180, 270) // Left half
  const redArc = createArcPath(center, radius, 270, 360) // Right half

  const isDraggable = !!onUserPercentageChange && userPercentage !== undefined

  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`overflow-visible${isDraggable ? ' select-none' : ''}`}
        style={isDraggable ? { cursor: isDragging ? 'grabbing' : 'grab' } : undefined}
        onPointerDown={isDraggable ? handlePointerDown : undefined}
        onPointerMove={isDraggable ? handlePointerMove : undefined}
        onPointerUp={isDraggable ? handlePointerUp : undefined}
        onPointerCancel={isDraggable ? handlePointerUp : undefined}
      >
        <defs>
          <linearGradient id={theme.greenGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.greenStart} />
            <stop offset="100%" stopColor={theme.greenMiddle} />
          </linearGradient>
          <linearGradient id={theme.redGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.redMiddle} />
            <stop offset="100%" stopColor={theme.redEnd} />
          </linearGradient>
          <filter id={theme.shadowId} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Background track */}
        <path d={backgroundArc} fill="none" stroke={theme.grayBackground} strokeWidth={strokeWidth} strokeLinecap="round" />

        {/* Arcs */}
        <path d={greenArc} fill="none" stroke={`url(#${theme.greenGradientId})`} strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d={redArc} fill="none" stroke={`url(#${theme.redGradientId})`} strokeWidth={strokeWidth} strokeLinecap="round" />

        {/* Market Mark (tick) */}
        {(() => {
          const { x1, y1, x2, y2 } = getTickEnds(safeMarketPct)
          return (
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={theme.needleMarket}
              strokeWidth={2}
              strokeLinecap="round"
              className="transition-all duration-700 ease-in-out"
            />
          )
        })()}

        {/* AI Mark (tick) */}
        {aiPercentage !== undefined && (() => {
          const { x1, y1, x2, y2 } = getTickEnds(aiPercentage)
          return (
            <line
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={theme.needleAI}
              strokeWidth={2.5}
              strokeLinecap="round"
              filter={`url(#${theme.shadowId})`}
            />
          )
        })()}

        {/* User Needle (Thick) */}
        {userPercentage !== undefined && (
          <path
            d={getNeedlePath(userPercentage, needleBase * 2, true)}
            fill={theme.needleUser}
            filter={`url(#${theme.shadowId})`}
            className="transition-all duration-150 ease-out"
          />
        )}

        {/* Pivot */}
        <circle cx={center.x} cy={center.y} r={pivotRadius} fill={theme.grayBackground} stroke={theme.needleMarket} strokeWidth="1" />

        {/* Display Text */}
        <text
          x={center.x}
          y={center.y - radius * 0.42}
          textAnchor="middle"
          dominantBaseline="middle"
          className="font-black"
          style={{ fontSize, fill: theme.text }}
        >
          {userPercentage !== undefined ? Math.round(userPercentage) : Math.round(safeMarketPct)}%
        </text>
      </svg>

      {label && (
        <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary text-center px-4">
          {label}
        </span>
      )}
    </div>
  )
}

function createArcPath(center: { x: number; y: number }, radius: number, startAngle: number, endAngle: number): string {
  if (Math.abs(startAngle - endAngle) < 0.5) return ''
  const start = polarToCartesian(center.x, center.y, radius, startAngle)
  const end = polarToCartesian(center.x, center.y, radius, endAngle)
  const sweepFlag = endAngle > startAngle ? 1 : 0
  return ['M', start.x, start.y, 'A', radius, radius, 0, 0, sweepFlag, end.x, end.y].join(' ')
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number): { x: number; y: number } {
  const angleInRadians = (angleInDegrees * Math.PI) / 180
  return { x: centerX + radius * Math.cos(angleInRadians), y: centerY + radius * Math.sin(angleInRadians) }
}
