// Hodgkin–Huxley physics, pure and React-free.
// Ported verbatim (math) from legacy/HodgkinHuxley.jsx (modern convention,
// rest ≈ −65 mV). Singularity guards and constants preserved exactly.

import type { Currents, Deriv, HHParams, HHState } from './types'

// ---- fixed biophysical constants ----
export const Cm = 1.0 // µF/cm²
export const ENa = 50.0 // mV
export const EK = -77.0 // mV
export const EL = -54.387 // mV
export const GL = 0.3 // mS/cm² — default leak conductance
export const Q10 = 3.0
export const T_REF = 6.3 // °C — temperature the HH rates were measured at

// ---- simulation window / timing ----
export const WINDOW_MS = 50
export const SAMPLE_DT = 0.1 // ms between stored samples
export const MAX_PTS = Math.round(WINDOW_MS / SAMPLE_DT) // 500
export const DT = 0.01 // ms — default integrator step
export const STEPS_PER_SAMPLE = Math.round(SAMPLE_DT / DT) // 10
export const SAMPLES_PER_FRAME = 6 // ≈0.6 ms simulated per animation frame

// ---- stimulus pulse (brief suprathreshold kick, legacy "⚡" button) ----
export const PULSE_AMP = 14 // µA/cm² added on top of iStim
export const PULSE_MS = 0.8 // ms

// ---- stimulus protocols (DEVELOPMENT.md §4.4) ----
export const TRAIN_PERIOD = 20 // ms — 50 Hz pulse train
export const TRAIN_DUTY = 1 // ms — pulse width within the train
export const RAMP_PERIOD = 250 // ms — triangular ramp period

// spike detection convention: upward crossing of 0 mV; re-arm below this V
export const SPIKE_THRESHOLD = 0 // mV
export const SPIKE_REARM = -10 // mV

const EPS = 1e-7

// ---- gating rate functions (V in mV, rates in 1/ms) ----
// Singularities at V=−55 (αn) and V=−40 (αm) resolved by their analytic limits.
export function alphaN(V: number): number {
  const x = V + 55
  const d = 1 - Math.exp(-x / 10)
  return Math.abs(d) < EPS ? 0.1 : (0.01 * x) / d
}
export function betaN(V: number): number {
  return 0.125 * Math.exp(-(V + 65) / 80)
}
export function alphaM(V: number): number {
  const x = V + 40
  const d = 1 - Math.exp(-x / 10)
  return Math.abs(d) < EPS ? 1.0 : (0.1 * x) / d
}
export function betaM(V: number): number {
  return 4 * Math.exp(-(V + 65) / 18)
}
export function alphaH(V: number): number {
  return 0.07 * Math.exp(-(V + 65) / 20)
}
export function betaH(V: number): number {
  return 1 / (1 + Math.exp(-(V + 35) / 10))
}

/** Steady-state value x∞ = α/(α+β). */
export function xInf(a: number, b: number): number {
  return a / (a + b)
}

/** Steady-state activation of each gate at a given voltage. */
export function mInf(V: number): number {
  return xInf(alphaM(V), betaM(V))
}
export function hInf(V: number): number {
  return xInf(alphaH(V), betaH(V))
}
export function nInf(V: number): number {
  return xInf(alphaN(V), betaN(V))
}

/** Time constant of each gate at a given voltage: τ = 1/(φ·(α+β)). */
export function tauM(V: number, phi = 1): number {
  return 1 / (phi * (alphaM(V) + betaM(V)))
}
export function tauH(V: number, phi = 1): number {
  return 1 / (phi * (alphaH(V) + betaH(V)))
}
export function tauN(V: number, phi = 1): number {
  return 1 / (phi * (alphaN(V) + betaN(V)))
}

/** Temperature scaling factor φ = Q10^((T−T_ref)/10), applied to all gating rates. */
export function phiFor(temp: number): number {
  return Math.pow(Q10, (temp - T_REF) / 10)
}

/** Ionic currents at a state. */
export function currents(s: HHState, p: HHParams): Currents {
  const { V, m, h, n } = s
  return {
    iNa: p.gNa * m * m * m * h * (V - ENa),
    iK: p.gK * n * n * n * n * (V - EK),
    iL: p.gL * (V - EL),
  }
}

/**
 * Derivative of the HH system at a state, given the temperature factor φ and the
 * held external (stimulus) current iExt. dV includes the membrane equation:
 *   Cm·dV/dt = iExt − iNa − iK − iL
 */
export function deriv(
  s: HHState,
  p: HHParams,
  phi: number,
  iExt: number,
): Deriv {
  const { V, m, h, n } = s
  const c = currents(s, p)
  const dV = (iExt - c.iNa - c.iK - c.iL) / Cm
  const dm = phi * (alphaM(V) * (1 - m) - betaM(V) * m)
  const dh = phi * (alphaH(V) * (1 - h) - betaH(V) * h)
  const dn = phi * (alphaN(V) * (1 - n) - betaN(V) * n)
  return { dV, dm, dh, dn }
}

/** Resting (steady-state) initial conditions at V0 = −65 mV. */
export function restingState(): HHState {
  const V0 = -65
  return {
    V: V0,
    m: mInf(V0),
    h: hInf(V0),
    n: nInf(V0),
  }
}

/** True on an upward crossing of `threshold` between prevV and newV. */
export function crossedUpward(
  prevV: number,
  newV: number,
  threshold = SPIKE_THRESHOLD,
): boolean {
  return prevV < threshold && newV >= threshold
}

/**
 * Hysteresis for spike re-arming: once above threshold the detector stays armed
 * until the trace drops below `rearmAt`, preventing multiple counts per spike.
 */
export function rearmAbove(
  armed: boolean,
  newV: number,
  rearmAt = SPIKE_REARM,
): boolean {
  return armed && newV < rearmAt ? false : armed
}
