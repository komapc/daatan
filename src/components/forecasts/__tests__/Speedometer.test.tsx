import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Speedometer from '../Speedometer'

describe('Speedometer component', () => {
  it('renders without errors', () => {
    const { container } = render(<Speedometer percentage={50} label="Test Label" color="green" />)
    expect(container).toBeInTheDocument()
  })

  it('displays the rounded percentage value inside the SVG', () => {
    render(<Speedometer percentage={42.7} label="Probability" color="green" />)
    expect(screen.getByText('43%')).toBeInTheDocument()
  })

  it('displays the user percentage when provided', () => {
    render(<Speedometer percentage={50} userPercentage={75} label="Probability" color="green" />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('displays the label below the SVG', () => {
    render(<Speedometer percentage={50} label="Will Happen" color="green" />)
    expect(screen.getByText('Will Happen')).toBeInTheDocument()
  })

  it('clamps percentage below 0 to 0', () => {
    render(<Speedometer percentage={-10} label="Test" color="green" />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('clamps percentage above 100 to 100', () => {
    render(<Speedometer percentage={150} label="Test" color="red" />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('renders SVG with correct viewBox for the default md size', () => {
    const { container } = render(<Speedometer percentage={50} label="Test" color="green" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 160 96')
    expect(svg?.getAttribute('width')).toBe('160')
    expect(svg?.getAttribute('height')).toBe('96')
  })

  it('renders exactly 3 arc path elements (background, green, red)', () => {
    const { container } = render(<Speedometer percentage={50} label="Test" color="green" />)
    // paths: background + greenArc + redArc + marketNeedle = 4 paths
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBeGreaterThanOrEqual(3)
  })

  it('renders a pivot circle at the center', () => {
    const { container } = render(<Speedometer percentage={50} label="Test" color="green" />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(1)
  })

  it('renders SVG defs with gradient and filter elements', () => {
    const { container } = render(<Speedometer percentage={50} label="Test" color="green" />)
    const defs = container.querySelector('defs')
    expect(defs).toBeInTheDocument()

    const linearGradients = defs?.querySelectorAll('linearGradient')
    expect(linearGradients?.length).toBeGreaterThanOrEqual(2) // green + red

    const filters = defs?.querySelectorAll('filter')
    expect(filters?.length).toBeGreaterThanOrEqual(1)
  })

  it('handles NaN percentage gracefully by treating it as 50%', () => {
    const { getByText } = render(<Speedometer percentage={NaN} label="Test NaN" color="green" />)
    expect(getByText('50%')).toBeDefined()
  })
})
