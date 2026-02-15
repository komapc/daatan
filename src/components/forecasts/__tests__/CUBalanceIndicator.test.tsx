import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CUBalanceIndicator from '../CUBalanceIndicator'

describe('CUBalanceIndicator Component', () => {
  it('displays the available CU amount', () => {
    render(<CUBalanceIndicator cuAvailable={75} cuLocked={25} />)
    const elements = screen.getAllByText('75')
    expect(elements.length).toBeGreaterThanOrEqual(1)
  })

  it('displays the locked CU amount', () => {
    render(<CUBalanceIndicator cuAvailable={75} cuLocked={25} />)
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('shows total CU when showDetails is true', () => {
    render(<CUBalanceIndicator cuAvailable={60} cuLocked={40} showDetails />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('hides total CU when showDetails is false (default)', () => {
    render(<CUBalanceIndicator cuAvailable={60} cuLocked={40} />)
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })

  it('renders green accent for high available CU (>50)', () => {
    const { container } = render(<CUBalanceIndicator cuAvailable={75} cuLocked={25} />)
    const circles = container.querySelectorAll('circle')
    const accentCircle = circles[1]
    expect(accentCircle.getAttribute('stroke')).toBe('#22c55e')
  })

  it('renders yellow accent for medium available CU (10-50)', () => {
    const { container } = render(<CUBalanceIndicator cuAvailable={30} cuLocked={70} />)
    const circles = container.querySelectorAll('circle')
    const accentCircle = circles[1]
    expect(accentCircle.getAttribute('stroke')).toBe('#eab308')
  })

  it('renders red accent for low available CU (<10)', () => {
    const { container } = render(<CUBalanceIndicator cuAvailable={5} cuLocked={95} />)
    const circles = container.querySelectorAll('circle')
    const accentCircle = circles[1]
    expect(accentCircle.getAttribute('stroke')).toBe('#ef4444')
  })

  it('handles zero total CU gracefully', () => {
    const { container } = render(<CUBalanceIndicator cuAvailable={0} cuLocked={0} />)
    expect(container).toBeInTheDocument()
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(1)
  })
})
