// Presets and default control state. Mirrors the legacy PRESETS in
// HodgkinHuxley.jsx, extended with integrator method + dt (DEVELOPMENT.md §4.1).

import { DT, GL, T_REF } from './hh'
import type { HHParams, IntegratorMethod, StimulusProtocol } from './types'

/** Everything the simulation loop reads each frame. */
export interface ControlState extends HHParams {
  method: IntegratorMethod
  dt: number // ms
  protocol: StimulusProtocol
}

export const DEFAULT_CONTROL: ControlState = {
  gNa: 120,
  gK: 36,
  gL: GL,
  temp: T_REF,
  iStim: 0,
  method: 'euler',
  dt: DT,
  protocol: 'step',
}

export interface Preset extends ControlState {
  label: string
  /** fire a brief stimulus pulse right after applying the preset */
  pulse?: boolean
}

export const PRESETS: Record<string, Preset> = {
  rest: { ...DEFAULT_CONTROL, label: 'Reposo' },
  single: { ...DEFAULT_CONTROL, label: 'Un disparo', pulse: true },
  train: { ...DEFAULT_CONTROL, label: 'Tren de disparos', iStim: 10 },
  cooled: { ...DEFAULT_CONTROL, label: 'Templado (28°C)', temp: 28, iStim: 12 },
  block: { ...DEFAULT_CONTROL, label: 'TTX parcial (gNa↓)', gNa: 30, iStim: 12 },
}
