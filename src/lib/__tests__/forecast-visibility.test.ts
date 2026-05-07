import { describe, it, expect } from 'vitest'
import { isForecastViewableByVisitor } from '../forecast-visibility'

const baseForecast = {
  isPublic: true,
  status: 'ACTIVE',
  author: { id: 'author-1' },
}

describe('isForecastViewableByVisitor', () => {
  it('lets anyone view a public ACTIVE forecast', () => {
    expect(isForecastViewableByVisitor(baseForecast, {})).toBe(true)
    expect(isForecastViewableByVisitor(baseForecast, { userId: 'someone' })).toBe(true)
  })

  it('lets anyone view public RESOLVED_CORRECT/RESOLVED_WRONG/PENDING', () => {
    for (const status of ['RESOLVED_CORRECT', 'RESOLVED_WRONG', 'PENDING']) {
      expect(isForecastViewableByVisitor({ ...baseForecast, status }, {})).toBe(true)
    }
  })

  it('hides DRAFT and PENDING_APPROVAL from anonymous viewers', () => {
    for (const status of ['DRAFT', 'PENDING_APPROVAL']) {
      expect(isForecastViewableByVisitor({ ...baseForecast, status }, {})).toBe(false)
    }
  })

  it('still allows VOID and UNRESOLVABLE viewing — committed users may need to look back', () => {
    for (const status of ['VOID', 'UNRESOLVABLE']) {
      expect(isForecastViewableByVisitor({ ...baseForecast, status }, {})).toBe(true)
    }
  })

  it('hides non-public forecasts from anonymous viewers', () => {
    expect(isForecastViewableByVisitor({ ...baseForecast, isPublic: false }, {})).toBe(false)
  })

  it('lets the author view their own forecast in any state', () => {
    const visitor = { userId: 'author-1' }
    for (const status of ['DRAFT', 'PENDING_APPROVAL', 'VOID', 'UNRESOLVABLE', 'ACTIVE']) {
      expect(isForecastViewableByVisitor({ ...baseForecast, status, isPublic: false }, visitor))
        .toBe(true)
    }
  })

  it('lets ADMIN and APPROVER view any forecast', () => {
    const draft = { ...baseForecast, status: 'PENDING_APPROVAL', isPublic: false }
    expect(isForecastViewableByVisitor(draft, { role: 'ADMIN' })).toBe(true)
    expect(isForecastViewableByVisitor(draft, { role: 'APPROVER' })).toBe(true)
  })

  it('does not grant viewing to non-admin USER role', () => {
    const draft = { ...baseForecast, status: 'DRAFT' }
    expect(isForecastViewableByVisitor(draft, { userId: 'someone-else', role: 'USER' })).toBe(false)
  })
})
