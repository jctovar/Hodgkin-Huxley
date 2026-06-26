import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Controls } from './Controls'
import { DEFAULT_CONTROL, PRESETS } from '../sim/presets'

function setup(overrides: Partial<Parameters<typeof Controls>[0]> = {}) {
  const handlers = {
    onPatch: vi.fn(),
    onToggleRun: vi.fn(),
    onReset: vi.fn(),
    onFirePulse: vi.fn(),
    onPreset: vi.fn(),
    onToggleRecord: vi.fn(),
    onExportCsv: vi.fn(),
  }
  const utils = render(
    <Controls
      control={DEFAULT_CONTROL}
      running
      recording={false}
      phi={1}
      presets={PRESETS}
      {...handlers}
      {...overrides}
    />,
  )
  return { ...handlers, ...utils }
}

describe('Controls', () => {
  it('renders the run state label and all preset buttons', () => {
    setup()
    expect(screen.getByText('❚❚ Pausar')).toBeInTheDocument() // running === true
    expect(screen.getByText('↺ Reiniciar')).toBeInTheDocument()
    expect(screen.getByText('⚡ Inyectar pulso (estímulo breve)')).toBeInTheDocument()
    for (const label of ['Reposo', 'Un disparo', 'Tren de disparos', 'Templado (28°C)', 'TTX parcial (gNa↓)']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('shows the resume label when paused', () => {
    setup({ running: false })
    expect(screen.getByText('▶ Reanudar')).toBeInTheDocument()
  })

  it('wires action buttons to their handlers', () => {
    const h = setup()
    fireEvent.click(screen.getByText('❚❚ Pausar'))
    fireEvent.click(screen.getByText('↺ Reiniciar'))
    fireEvent.click(screen.getByText('⚡ Inyectar pulso (estímulo breve)'))
    fireEvent.click(screen.getByText('Tren de disparos'))
    expect(h.onToggleRun).toHaveBeenCalledTimes(1)
    expect(h.onReset).toHaveBeenCalledTimes(1)
    expect(h.onFirePulse).toHaveBeenCalledTimes(1)
    expect(h.onPreset).toHaveBeenCalledWith('train')
  })

  it('emits a patch when a slider is moved', () => {
    const h = setup({ control: { ...DEFAULT_CONTROL, iStim: 0 } })
    const slider = screen.getByLabelText(/Corriente inyectada/) as HTMLInputElement
    fireEvent.change(slider, { target: { value: '12' } })
    expect(h.onPatch).toHaveBeenCalledWith({ iStim: 12 })
  })

  it('switches the integrator method via the selector', () => {
    const h = setup()
    fireEvent.change(screen.getByLabelText('Integrador'), { target: { value: 'rk4' } })
    expect(h.onPatch).toHaveBeenCalledWith({ method: 'rk4' })
  })

  it('wires the record and export buttons', () => {
    const h = setup()
    fireEvent.click(screen.getByText('● Grabar'))
    fireEvent.click(screen.getByText('⤓ Exportar CSV'))
    expect(h.onToggleRecord).toHaveBeenCalledTimes(1)
    expect(h.onExportCsv).toHaveBeenCalledTimes(1)
  })

  it('shows the stop label while recording', () => {
    setup({ recording: true })
    expect(screen.getByText('■ Detener')).toBeInTheDocument()
  })
})
