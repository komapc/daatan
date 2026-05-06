const META_DESCRIPTION_MAX = 158

export function buildForecastDescription(
  claimText: string,
  detailsText: string | null | undefined,
): string {
  const trimmedDetails = detailsText?.trim()
  if (trimmedDetails && trimmedDetails.length >= 30) {
    return truncate(trimmedDetails, META_DESCRIPTION_MAX)
  }
  return truncate(claimText, META_DESCRIPTION_MAX)
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}
