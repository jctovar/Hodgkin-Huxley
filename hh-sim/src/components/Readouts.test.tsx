import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Readouts } from './Readouts'
import type { Readout } from '../sim/types'

const readout: Readout = {
  V: -43.2,
  m: 0.12,
  h: 0.74,
  n: 0.31,
  iNa: -540,
  iK: 12,
  iL: 3,
  spikes: 3,
}

describe('Readouts', () => {
  it('renders the live Vₘ and current values formatted', () => {
    render(<Readouts readout={readout} />)
    expect(screen.getByText('-43.2 mV')).toBeInTheDocument()
    expect(screen.getByText('-540 µA/cm²')).toBeInTheDocument()
    expect(screen.getByText('12 µA/cm²')).toBeInTheDocument()
  })

  it('renders a labelled bar for each gate with its numeric value', () => {
    const { container } = render(<Readouts readout={readout} />)
    expect(screen.getByText('0.12')).toBeInTheDocument() // m
    expect(screen.getByText('0.74')).toBeInTheDocument() // h
    expect(screen.getByText('0.31')).toBeInTheDocument() // n
    const fills = container.querySelectorAll('[class*="gateFill"]')
    expect(fills).toHaveLength(3)
  })

  it('clamps gate widths to [0, 100]%', () => {
    const { container } = render(
      <Readouts readout={{ ...readout, m: 5, h: -2, n: 0.4 }} />,
    )
    const widths = [...container.querySelectorAll('[class*="gateFill"]')].map((el) =>
      (el as HTMLElement).style.width,
    )
    expect(widths[0]).toBe('100%') // m clamped up
    expect(widths[1]).toBe('0%') // h clamped down
    expect(widths[2]).toBe('40%') // n as-is
  })
})
