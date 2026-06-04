import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import { CommitmentsHistory } from '../CommitmentsHistory'
import type { Prediction } from '../types'
import enMessages from '../../../../../../messages/en.json'

const commitment = (id: string, userId: string, name: string, binaryChoice: boolean, cu: number) => ({
  id,
  cuCommitted: cu,
  binaryChoice,
  optionId: null,
  rsChange: null,
  brierScore: null,
  user: { id: userId, name, username: name.toLowerCase(), image: null },
  option: null,
})

const base = {
  id: 'pred-1',
  outcomeType: 'BINARY',
  status: 'ACTIVE',
  author: { id: 'author-1', name: 'MajorityVoter', username: 'majorityvoter', image: null, rs: 0, role: 'USER' },
} as unknown as Prediction

const wrap = (prediction: Prediction, authorId?: string) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CommitmentsHistory prediction={prediction} authorId={authorId} />
    </NextIntlClientProvider>,
  )

describe('CommitmentsHistory — author badge', () => {
  it('tags the author row with an Author badge when the author also voted', () => {
    const prediction = {
      ...base,
      commitments: [
        commitment('c1', 'author-1', 'MajorityVoter', true, 68),
        commitment('c2', 'other-1', 'RiskyGuy', false, -14),
      ],
    } as unknown as Prediction
    wrap(prediction, 'author-1')
    expect(screen.getByText('Author')).toBeInTheDocument()
  })

  it('shows no Author badge when the author is not among the voters', () => {
    const prediction = {
      ...base,
      commitments: [commitment('c2', 'other-1', 'RiskyGuy', false, -14)],
    } as unknown as Prediction
    wrap(prediction, 'author-1')
    expect(screen.queryByText('Author')).toBeNull()
  })
})
