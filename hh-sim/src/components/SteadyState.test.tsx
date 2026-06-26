import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { SteadyState } from './SteadyState'

describe('SteadyState', () => {
  it('renders a labelled canvas and the gate legend', () => {
    render(<SteadyState />)
    expect(screen.getByLabelText('Curvas estacionarias de activación')).toBeInTheDocument()
    for (const label of ['m∞', 'h∞', 'n∞', 'τ (ms)']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('repaints on window resize without throwing', () => {
    render(<SteadyState />)
    expect(() => {
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
    }).not.toThrow()
  })
})
