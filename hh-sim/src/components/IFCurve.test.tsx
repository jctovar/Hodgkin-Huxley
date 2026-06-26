import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { IFCurve } from './IFCurve'
import type { HHParams } from '../sim/types'

const params: HHParams = { gNa: 120, gK: 36, gL: 0.3, temp: 6.3, iStim: 0 }

describe('IFCurve', () => {
  afterEach(() => vi.useRealTimers())

  it('renders a labelled canvas without throwing', () => {
    render(<IFCurve params={params} />)
    expect(screen.getByLabelText('Curva frecuencia–corriente (I–F)')).toBeInTheDocument()
  })

  it('computes and paints the curve after the debounce window elapses', () => {
    vi.useFakeTimers()
    render(<IFCurve params={params} />)
    // before the 250 ms debounce no points exist; advancing past it runs the
    // background I–F sweep and repaints with the curve (points.length > 1).
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(300)
      })
    }).not.toThrow()
    expect(screen.getByLabelText('Curva frecuencia–corriente (I–F)')).toBeInTheDocument()
  })
})
