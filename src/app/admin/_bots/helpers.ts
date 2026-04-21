export function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const abs = Math.abs(diff)
  const future = diff < 0

  if (abs < 60_000) return future ? 'in <1m' : 'just now'
  if (abs < 3600_000) return `${future ? 'in ' : ''}${Math.round(abs / 60_000)}m${future ? '' : ' ago'}`
  if (abs < 86400_000) return `${future ? 'in ' : ''}${Math.round(abs / 3600_000)}h${future ? '' : ' ago'}`
  return `${future ? 'in ' : ''}${Math.round(abs / 86400_000)}d${future ? '' : ' ago'}`
}

export function actionBadge(action: string): string {
  switch (action) {
    case 'CREATED_FORECAST': return 'bg-green-100 text-teal'
    case 'VOTED': return 'bg-blue-100 text-cobalt-light'
    case 'SKIPPED': return 'bg-navy-700 text-gray-400'
    case 'ERROR': return 'bg-red-100 text-red-400'
    default: return 'bg-navy-700 text-gray-400'
  }
}
