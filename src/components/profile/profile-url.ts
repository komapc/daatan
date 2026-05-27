// Builds profile page URLs that correctly preserve/reset tab, tag, and page params.
// Rules: switching tab or tag resets page to 1; pagination preserves both.
export function buildProfileUrl(
  pathname: string,
  overrides: { tab?: string; tag?: string | null; page?: number },
  current: URLSearchParams
): string {
  const tab = overrides.tab ?? current.get('tab') ?? 'created'
  const tag = overrides.tag !== undefined ? overrides.tag : current.get('tag')
  const page = overrides.page ?? 1

  const params = new URLSearchParams()
  if (tab !== 'created') params.set('tab', tab)
  if (tag) params.set('tag', tag)
  if (page > 1) params.set('page', String(page))

  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
