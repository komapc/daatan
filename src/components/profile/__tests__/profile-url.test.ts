import { describe, it, expect } from 'vitest'
import { buildProfileUrl } from '../profile-url'

function params(obj: Record<string, string>) {
  return new URLSearchParams(obj)
}

describe('buildProfileUrl', () => {
  it('returns bare pathname when all values are default', () => {
    expect(buildProfileUrl('/profile/alice', {}, params({}))).toBe('/profile/alice')
  })

  it('omits tab param when tab is "created" (the default)', () => {
    const url = buildProfileUrl('/profile/alice', { tab: 'created' }, params({}))
    expect(url).toBe('/profile/alice')
  })

  it('includes tab param when tab is not "created"', () => {
    const url = buildProfileUrl('/profile/alice', { tab: 'participated' }, params({}))
    expect(url).toBe('/profile/alice?tab=participated')
  })

  it('includes page param when page > 1', () => {
    const url = buildProfileUrl('/profile/alice', { page: 2 }, params({}))
    expect(url).toBe('/profile/alice?page=2')
  })

  it('omits page param when page is 1', () => {
    const url = buildProfileUrl('/profile/alice', { page: 1 }, params({ page: '3' }))
    expect(url).toBe('/profile/alice')
  })

  it('includes tag when provided', () => {
    const url = buildProfileUrl('/profile/alice', { tag: 'ukraine' }, params({}))
    expect(url).toBe('/profile/alice?tag=ukraine')
  })

  it('drops tag when override is null', () => {
    const url = buildProfileUrl('/profile/alice', { tag: null }, params({ tag: 'ukraine' }))
    expect(url).toBe('/profile/alice')
  })

  it('preserves current tab when only tag changes', () => {
    const url = buildProfileUrl(
      '/profile/alice',
      { tag: 'ukraine' },
      params({ tab: 'resolved' })
    )
    expect(url).toBe('/profile/alice?tab=resolved&tag=ukraine')
  })

  it('resets page to 1 when only tag changes', () => {
    const url = buildProfileUrl(
      '/profile/alice',
      { tag: 'ukraine' },
      params({ tab: 'resolved', page: '3' })
    )
    // page=1 is omitted, tab is preserved
    expect(url).toBe('/profile/alice?tab=resolved&tag=ukraine')
  })

  it('preserves current tag when only tab changes', () => {
    const url = buildProfileUrl(
      '/profile/alice',
      { tab: 'resolved' },
      params({ tag: 'ukraine' })
    )
    expect(url).toBe('/profile/alice?tab=resolved&tag=ukraine')
  })

  it('resets page to 1 when only tab changes', () => {
    const url = buildProfileUrl(
      '/profile/alice',
      { tab: 'resolved' },
      params({ tab: 'participated', tag: 'ukraine', page: '5' })
    )
    expect(url).toBe('/profile/alice?tab=resolved&tag=ukraine')
  })

  it('combines tab, tag, and page correctly', () => {
    const url = buildProfileUrl(
      '/profile/alice',
      { tab: 'resolved', tag: 'climate', page: 3 },
      params({})
    )
    expect(url).toBe('/profile/alice?tab=resolved&tag=climate&page=3')
  })
})
