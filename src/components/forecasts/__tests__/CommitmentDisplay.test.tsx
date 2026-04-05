import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CommitmentDisplay from '../CommitmentDisplay'

const baseCommitment = {
  id: 'c1',
  cuCommitted: 25,
  binaryChoice: false,
  rsSnapshot: 50,
  createdAt: '2026-02-15T09:33:00Z',
  rsChange: null,
  brierScore: null,
  option: null,
}

const activePrediction = { id: 'p1', status: 'ACTIVE', outcomeType: 'BINARY' }
const resolvedPrediction = { id: 'p2', status: 'RESOLVED_CORRECT', outcomeType: 'BINARY' }

describe('CommitmentDisplay Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('displays confidence value and implied probability', () => {
    render(
      <CommitmentDisplay commitment={baseCommitment} prediction={activePrediction} />
    )
    expect(screen.getByText('+25')).toBeInTheDocument()
    expect(screen.getByText(/implied/)).toBeInTheDocument()
  })

  it('shows "Won\'t Happen" badge for binaryChoice=false', () => {
    render(
      <CommitmentDisplay commitment={baseCommitment} prediction={activePrediction} />
    )
    expect(screen.getByText("Won't Happen")).toBeInTheDocument()
  })

  it('shows "Will Happen" badge for binaryChoice=true', () => {
    const commitment = { ...baseCommitment, binaryChoice: true }
    render(
      <CommitmentDisplay commitment={commitment} prediction={activePrediction} />
    )
    expect(screen.getByText('Will Happen')).toBeInTheDocument()
  })

  it('shows option text for multiple-choice commitment', () => {
    const commitment = {
      ...baseCommitment,
      binaryChoice: undefined,
      option: { id: 'opt1', text: 'Option A' },
    }
    render(
      <CommitmentDisplay commitment={commitment} prediction={activePrediction} />
    )
    expect(screen.getByText('Option A')).toBeInTheDocument()
  })

  it('displays the committed date', () => {
    render(
      <CommitmentDisplay commitment={baseCommitment} prediction={activePrediction} />
    )
    expect(screen.getByText(/Feb 15, 2026/)).toBeInTheDocument()
  })

  it('shows Edit and Remove buttons for active predictions', () => {
    const onEdit = vi.fn()
    const onRemove = vi.fn()
    render(
      <CommitmentDisplay
        commitment={baseCommitment}
        prediction={activePrediction}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    )
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('hides Edit and Remove buttons for resolved predictions', () => {
    render(
      <CommitmentDisplay
        commitment={baseCommitment}
        prediction={resolvedPrediction}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    )
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Remove')).not.toBeInTheDocument()
  })

  it('calls onEdit when Edit button is clicked', () => {
    const onEdit = vi.fn()
    render(
      <CommitmentDisplay
        commitment={baseCommitment}
        prediction={activePrediction}
        onEdit={onEdit}
        onRemove={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('shows confirm dialog after clicking Remove (no fetch)', () => {
    render(
      <CommitmentDisplay
        commitment={baseCommitment}
        prediction={activePrediction}
        onRemove={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Remove'))

    expect(screen.getByText('Confirm remove')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('cancels removal when Cancel is clicked', () => {
    render(
      <CommitmentDisplay
        commitment={baseCommitment}
        prediction={activePrediction}
        onRemove={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Remove'))
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('calls DELETE API and onRemove after confirming remove', async () => {
    const onRemove = vi.fn()
    global.fetch = vi.fn().mockResolvedValue({ ok: true })

    render(
      <CommitmentDisplay
        commitment={baseCommitment}
        prediction={activePrediction}
        onRemove={onRemove}
      />
    )

    fireEvent.click(screen.getByText('Remove'))
    fireEvent.click(screen.getByText('Confirm remove'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/forecasts/p1/commit', { method: 'DELETE' })
      expect(onRemove).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error message when DELETE fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    render(
      <CommitmentDisplay
        commitment={baseCommitment}
        prediction={activePrediction}
        onRemove={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Remove'))
    fireEvent.click(screen.getByText('Confirm remove'))

    await waitFor(() => {
      expect(screen.getByText(/Failed to remove commitment/)).toBeInTheDocument()
    })
  })

  it('displays resolution results when resolved', () => {
    const resolvedCommitment = {
      ...baseCommitment,
      cuCommitted: 80,
      rsChange: 25,
      brierScore: 0.0,
    }
    render(
      <CommitmentDisplay
        commitment={resolvedCommitment}
        prediction={resolvedPrediction}
      />
    )
    expect(screen.getByText('Resolution Results')).toBeInTheDocument()
    expect(screen.getByText('+25')).toBeInTheDocument()
    expect(screen.getByText('0.000')).toBeInTheDocument()
  })

  it('displays negative RS change with correct styling', () => {
    const resolvedCommitment = {
      ...baseCommitment,
      rsChange: -3,
      brierScore: 0.28,
    }
    render(
      <CommitmentDisplay
        commitment={resolvedCommitment}
        prediction={resolvedPrediction}
      />
    )
    expect(screen.getByText('-3')).toBeInTheDocument()
    expect(screen.getByText('0.280')).toBeInTheDocument()
  })
})
