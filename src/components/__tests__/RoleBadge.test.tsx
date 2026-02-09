import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RoleBadge } from '../RoleBadge'

describe('RoleBadge', () => {
  it('renders nothing for USER or undefined role', () => {
    const { container: userContainer } = render(<RoleBadge role="USER" />)
    expect(userContainer).toBeEmptyDOMElement()

    const { container: undefinedContainer } = render(<RoleBadge role={undefined} />)
    expect(undefinedContainer).toBeEmptyDOMElement()
  })

  it('renders Admin badge for ADMIN role', () => {
    render(<RoleBadge role="ADMIN" />)

    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('renders Resolver badge for RESOLVER role', () => {
    render(<RoleBadge role="RESOLVER" />)

    expect(screen.getByText('Resolver')).toBeInTheDocument()
  })

  it('applies size variants', () => {
    const { rerender } = render(<RoleBadge role="ADMIN" size="sm" />)
    const small = screen.getByText('Admin')
    expect(small.className).toContain('text-[10px]')

    rerender(<RoleBadge role="ADMIN" size="md" />)
    const medium = screen.getByText('Admin')
    expect(medium.className).toContain('text-xs')
  })
})

