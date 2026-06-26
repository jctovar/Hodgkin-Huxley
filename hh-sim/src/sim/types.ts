// Core types for the Hodgkin–Huxley simulation engine.

/** User-controllable parameters. Units in comments. */
export interface HHParams {
  gNa: number // mS/cm²
  gK: number // mS/cm²
  gL: number // mS/cm²
  temp: number // °C
  iStim: number // µA/cm² — continuous injected current
}

/** Membrane state: potential + the three gating variables. */
export interface HHState {
  V: number // mV
  m: number // dimensionless (0–1)
  h: number // dimensionless (0–1)
  n: number // dimensionless (0–1)
}

/** Ionic currents at a state. */
export interface Currents {
  iNa: number // µA/cm²
  iK: number // µA/cm²
  iL: number // µA/cm²
}

/** A stored sample = state + currents + time, for plotting/CSV. */
export interface Sample extends HHState, Currents {
  t: number // ms
}

/** Instantaneous derivatives of the HH ODE system. */
export interface Deriv {
  dV: number
  dm: number
  dh: number
  dn: number
}

export type IntegratorMethod = 'euler' | 'rk4'

/** Stimulus waveform applied on top of (or instead of) the continuous I slider. */
export type StimulusProtocol = 'step' | 'train' | 'ramp'

/** Live values shown in the readout panel, driven from the animation loop. */
export interface Readout {
  V: number
  m: number
  h: number
  n: number
  iNa: number
  iK: number
  iL: number
  spikes: number
}

/** A step integrator advances the state by dt given a held external current. */
export type Integrator = (
  s: HHState,
  p: HHParams,
  phi: number,
  iExt: number,
  dt: number,
) => HHState
