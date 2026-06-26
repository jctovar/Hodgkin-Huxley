import { describe, it, expect } from 'vitest'
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { PhasePlane, type PhasePlaneHandle } from './PhasePlane'

describe('PhasePlane', () => {
  it('renders a labelled canvas', () => {
    render(<PhasePlane />)
    expect(screen.getByLabelText('Plano de fase Vₘ–n')).toBeInTheDocument()
  })

  it('draws the (V, n) trajectory without throwing', () => {
    const ref = createRef<PhasePlaneHandle>()
    render(<PhasePlane ref={ref} />)
    expect(ref.current).not.toBeNull()
    const V = new Array(500).fill(-65)
    const n = new Array(500).fill(0.3)
    // fill with a small excursion so the trail + nullcline render
    for (let i = 0; i < V.length; i++) {
      V[i] = -65 + 30 * Math.sin((i / V.length) * Math.PI * 4)
      n[i] = 0.3 + 0.3 * (1 - Math.cos((i / V.length) * Math.PI * 4)) / 2
    }
    expect(() => ref.current!.draw(V, n)).not.toThrow()
  })
})
