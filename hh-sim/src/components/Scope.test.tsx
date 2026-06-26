import { describe, it, expect } from 'vitest'
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { Scope, type ScopeHandle } from './Scope'

describe('Scope', () => {
  it('renders a labelled canvas', () => {
    render(<Scope label="test panel" />)
    expect(screen.getByLabelText('test panel')).toBeInTheDocument()
  })

  it('renders legend items when provided', () => {
    render(<Scope legend={[{ c: '#f00', t: 'Na' }, { c: '#0f0', t: 'K' }]} />)
    expect(screen.getByText('Na')).toBeInTheDocument()
    expect(screen.getByText('K')).toBeInTheDocument()
  })

  it('exposes an imperative draw() that paints without throwing', () => {
    const ref = createRef<ScopeHandle>()
    render(<Scope ref={ref} label="scope" />)
    expect(ref.current).not.toBeNull()
    const data = new Array(500).fill(0)
    expect(() => {
      ref.current!.draw(
        [{ data, color: '#ffd166', w: 2, glow: true }],
        [-90, 55],
        { title: 'Vₘ', unit: 'mV', zero: 0 },
      )
    }).not.toThrow()
  })
})
