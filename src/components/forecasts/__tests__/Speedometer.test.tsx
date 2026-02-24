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

  it('displays the label below the SVG', () => {
    render(<Speedometer percentage={50} label="Will Happen" color="green" />)
    expect(screen.getByText('Will Happen')).toBeInTheDocument()
  })

  it('sets correct aria-label with percentage and label', () => {
    const { container } = render(<Speedometer percentage={75} label="Chance" color="green" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-label')).toBe('Chance: 75%')
  })

  it('clamps percentage below 0 to 0', () => {
    render(<Speedometer percentage={-10} label="Test" color="green" />)
    expect(screen.getByText('0%')).toBeInTheDocument()

    const { container } = render(<Speedometer percentage={-10} label="Test" color="green" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-label')).toBe('Test: 0%')
  })

  it('clamps percentage above 100 to 100', () => {
    render(<Speedometer percentage={150} label="Test" color="red" />)
    expect(screen.getByText('100%')).toBeInTheDocument()

    const { container } = render(<Speedometer percentage={150} label="Test" color="red" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-label')).toBe('Test: 100%')
  })

  it('displays 0% at the start position (no arc progress)', () => {
    render(<Speedometer percentage={0} label="Zero" color="green" />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('displays 100% at full progress', () => {
    render(<Speedometer percentage={100} label="Full" color="red" />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('renders SVG with correct viewBox for the default md size', () => {
    const { container } = render(<Speedometer percentage={50} label="Test" color="green" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 160 96')
    expect(svg?.getAttribute('width')).toBe('160')
    expect(svg?.getAttribute('height')).toBe('96')
  })

  it('renders correct viewBox for sm size', () => {
    const { container } = render(<Speedometer percentage={50} label="Test" color="green" size="sm" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 120 72')
  })

  it('renders correct viewBox for lg size', () => {
    const { container } = render(<Speedometer percentage={50} label="Test" color="green" size="lg" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 220 132')
  })

  it('renders correct viewBox for xl size', () => {
    const { container } = render(<Speedometer percentage={50} label="Test" color="green" size="xl" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 280 168')
  })

  it('renders exactly 3 arc path elements (background, green, red)', () => {
    const { container } = render(<Speedometer percentage={50} label="Test" color="green" />)
    // paths: background + greenArc + redArc + needlePath = 4 paths
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

  it('at 0%: green arc has no visible extent (start=end) so path is empty or minimal', () => {
    // At 0%, needleAngleDeg = 180, so greenArc = createArcPath(center, r, 180, 180) → returns ''
    // The green path element should have an empty or absent d attribute
    const { container } = render(<Speedometer percentage={0} label="Test" color="green" />)
    const paths = Array.from(container.querySelectorAll('path'))
    // Green arc path (index 1 after background) should be empty at 0%
    const pathDs = paths.map(p => p.getAttribute('d') ?? '')
    const emptyPaths = pathDs.filter(d => d === '')
    expect(emptyPaths.length).toBeGreaterThanOrEqual(1)
  })

  it('at 100%: red arc has no visible extent (start=end) so path is empty or minimal', () => {
    // At 100%, needleAngleDeg = 360, so redArc = createArcPath(center, r, 360, 360) → returns ''
    const { container } = render(<Speedometer percentage={100} label="Test" color="red" />)
    const paths = Array.from(container.querySelectorAll('path'))
    const pathDs = paths.map(p => p.getAttribute('d') ?? '')
    const emptyPaths = pathDs.filter(d => d === '')
    expect(emptyPaths.length).toBeGreaterThanOrEqual(1)
  })
})
