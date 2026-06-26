import { describe, it, expect } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import App from './App'

/** Drive the rAF loop n times, wrapped in act() so React state updates settle. */
function tick(n: number): void {
  act(() => {
    for (let i = 0; i < n; i++) flushRaf()
  })
}

/** The Splash overlay is shown on every App mount; dismiss it for assertions. */
function dismissSplash() {
  const dialog = screen.queryByRole('dialog')
  if (dialog) fireEvent.click(dialog)
}

describe('App', () => {
  it('renders the header, scopes and all preset buttons', () => {
    render(<App />)
    dismissSplash()
    expect(screen.getByText('Potencial de acción de una neurona')).toBeInTheDocument()
    expect(screen.getByText('Reposo')).toBeInTheDocument()
    expect(screen.getByText('Tren de disparos')).toBeInTheDocument()
    expect(screen.getByText('TTX parcial (gNa↓)')).toBeInTheDocument()
    // the three scope canvases exist
    expect(screen.getByLabelText('Potencial de membrana')).toBeInTheDocument()
    expect(screen.getByLabelText('Corrientes iónicas')).toBeInTheDocument()
    expect(screen.getByLabelText('Compuertas de activación')).toBeInTheDocument()
  })

  it('runs the animation loop without throwing when rAF is flushed', () => {
    render(<App />)
    dismissSplash()
    expect(() => tick(30)).not.toThrow()
  })

  it('fires spikes under the "Tren de disparos" preset', () => {
    render(<App />)
    dismissSplash()
    fireEvent.click(screen.getByText('Tren de disparos'))
    // iStim = 10 µA/cm² → repetitive firing; drive ~48 ms of simulated time
    tick(80)
    const label = screen.getByText('disparos')
    const chipText = label.parentElement?.textContent ?? ''
    const spikes = Number(chipText.replace('disparos', '').trim())
    expect(spikes).toBeGreaterThanOrEqual(1)
  })
})
