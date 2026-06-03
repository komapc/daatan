import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import { ForecastInfoPanel } from '../ForecastInfoPanel'
import type { Prediction } from '../types'
import enMessages from '../../../../../../messages/en.json'

const basePrediction = {
  id: 'pred-1',
  isPublic: true,
  shareToken: 'token',
  claimText: 'Test claim',
  outcomeType: 'BINARY',
  status: 'ACTIVE',
  resolveByDatetime: '2026-04-16T23:59:59.000Z',
  author: { id: 'u1', name: 'User', username: 'user', image: null, rs: 100, role: 'USER' },
} as unknown as Prediction

const wrap = (prediction: Prediction) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ForecastInfoPanel prediction={prediction} isMounted />
    </NextIntlClientProvider>,
  )

describe('ForecastInfoPanel — Tags box', () => {
  it('renders "None" when extractedEntities is an empty array', () => {
    // Regression: `[].map() || None` left a bare, empty Tags box because an
    // empty array is truthy. The fallback must fire on length 0 too.
    wrap({ ...basePrediction, extractedEntities: [] })
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('renders "None" when extractedEntities is undefined', () => {
    wrap({ ...basePrediction, extractedEntities: undefined })
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('renders the entity chips (capped at 3) when present', () => {
    wrap({ ...basePrediction, extractedEntities: ['Armenia', 'EU', 'Accession', 'Extra'] })
    expect(screen.getByText('Armenia')).toBeInTheDocument()
    expect(screen.getByText('EU')).toBeInTheDocument()
    expect(screen.getByText('Accession')).toBeInTheDocument()
    expect(screen.queryByText('Extra')).toBeNull()
    expect(screen.queryByText('None')).toBeNull()
  })
})
