/**
 * Statuses where the forecast hasn't been published to the public yet.
 * These pages have no useful crawl content and no committed users yet, so
 * we 404 them for unrelated visitors to avoid Google's "Soft 404" verdict.
 *
 * VOID and UNRESOLVABLE are deliberately excluded: those forecasts were
 * once active and may have committed users who legitimately need to look
 * back at what happened. They stay reachable with `robots: { index: false }`
 * (handled in generateMetadata) and rely on the rich SSR content from
 * comments + situation snapshots to not look like a Soft 404.
 */
const UNPUBLISHED_STATUSES = new Set(['DRAFT', 'PENDING_APPROVAL'])

interface VisitorContext {
  userId?: string | null
  role?: 'ADMIN' | 'APPROVER' | string | null
}

interface ForecastForVisibility {
  isPublic: boolean
  status: string
  author: { id: string }
}

export function isForecastViewableByVisitor(
  forecast: ForecastForVisibility,
  visitor: VisitorContext,
): boolean {
  const isOwner = visitor.userId != null && visitor.userId === forecast.author.id
  const isPrivileged = visitor.role === 'ADMIN' || visitor.role === 'APPROVER'
  if (isOwner || isPrivileged) return true

  if (!forecast.isPublic) return false
  if (UNPUBLISHED_STATUSES.has(forecast.status)) return false

  return true
}
