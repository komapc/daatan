const META_DESCRIPTION_MAX = 158

interface ForecastDescriptionCtx {
  resolveByDatetime?: string | Date
  commitmentCount?: number
  resolution?: { outcome: string; resolvedAt: string | Date }
}

export function buildForecastDescription(
  claimText: string,
  detailsText: string | null | undefined,
  ctx?: ForecastDescriptionCtx,
): string {
  const parts: string[] = []

  if (ctx?.resolution) {
    const { outcome, resolvedAt } = ctx.resolution
    const d = new Date(resolvedAt)
    const label = outcome.charAt(0).toUpperCase() + outcome.slice(1)
    parts.push(
      `Resolved as ${label} on ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    )
  }

  const trimmedDetails = detailsText?.trim()
  if (trimmedDetails && trimmedDetails.length >= 30) {
    parts.push(trimmedDetails)
    return truncate(parts.join('. '), META_DESCRIPTION_MAX)
  }

  parts.push(claimText)

  if (ctx && !ctx.resolution) {
    if (ctx.commitmentCount) {
      parts.push(`${ctx.commitmentCount} forecaster${ctx.commitmentCount !== 1 ? 's' : ''} have committed`)
    }
    if (ctx.resolveByDatetime) {
      const d = new Date(ctx.resolveByDatetime)
      parts.push(`resolves ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)
    }
  }

  if (parts.length > 1) {
    return truncate(parts.join('. '), META_DESCRIPTION_MAX)
  }

  return truncate(claimText, META_DESCRIPTION_MAX)
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}
