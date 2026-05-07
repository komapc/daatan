const META_DESCRIPTION_MAX = 158

interface ForecastDescriptionCtx {
  resolveByDatetime?: string | Date
  commitmentCount?: number
}

export function buildForecastDescription(
  claimText: string,
  detailsText: string | null | undefined,
  ctx?: ForecastDescriptionCtx,
): string {
  const trimmedDetails = detailsText?.trim()
  if (trimmedDetails && trimmedDetails.length >= 30) {
    return truncate(trimmedDetails, META_DESCRIPTION_MAX)
  }

  if (ctx) {
    const parts: string[] = [claimText]
    if (ctx.commitmentCount) {
      parts.push(`${ctx.commitmentCount} forecaster${ctx.commitmentCount !== 1 ? 's' : ''} have committed`)
    }
    if (ctx.resolveByDatetime) {
      const d = new Date(ctx.resolveByDatetime)
      parts.push(`resolves ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)
    }
    if (parts.length > 1) {
      return truncate(parts.join('. '), META_DESCRIPTION_MAX)
    }
  }

  return truncate(claimText, META_DESCRIPTION_MAX)
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}
