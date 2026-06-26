import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IFCurve } from './IFCurve'
import type { HHParams } from '../sim/types'

const params: HHParams = { gNa: 120, gK: 36, gL: 0.3, temp: 6.3, iStim: 0 }

describe('IFCurve', () => {
  it('renders a labelled canvas without throwing', () => {
    render(<IFCurve params={params} />)
    expect(screen.getByLabelText('Curva frecuencia–corriente (I–F)')).toBeInTheDocument()
  })
})
