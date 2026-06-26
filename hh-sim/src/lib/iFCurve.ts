// Firing-rate (I–F curve) computation, pure and synchronous. On-demand to keep
// the animation loop free (DEVELOPMENT.md §4.4). Runs a short integration per
// current step and counts spikes after a settle window.

import { INTEGRATORS } from '../sim/integrators'
import { phiFor, restingState, SPIKE_REARM, SPIKE_THRESHOLD } from '../sim/hh'
import type { HHParams, IntegratorMethod } from '../sim/types'

export interface IFOptions {
  duration?: number // ms total simulated per current step
  settle?: number // ms discarded before counting spikes
  dt?: number // ms integrator step
  method?: IntegratorMethod
}

export const IF_DEFAULTS: Required<IFOptions> = {
  duration: 500,
  settle: 120,
  dt: 0.01,
  method: 'euler',
}

/** Mean firing rate (Hz) of the model under a held current; 0 if it never spikes. */
export function firingRate(params: HHParams, iExt: number, opts: IFOptions = {}): number {
  const { duration, settle, dt, method } = { ...IF_DEFAULTS, ...opts }
  const integ = INTEGRATORS[method]
  const phi = phiFor(params.temp)
  let s = restingState()

  const settleSteps = Math.round(settle / dt)
  const measureSteps = Math.max(0, Math.round((duration - settle) / dt))

  for (let i = 0; i < settleSteps; i++) s = integ(s, params, phi, iExt, dt)

  let spikes = 0
  let armed = false
  for (let i = 0; i < measureSteps; i++) {
    const prev = s.V
    s = integ(s, params, phi, iExt, dt)
    if (!armed && prev < SPIKE_THRESHOLD && s.V >= SPIKE_THRESHOLD) {
      spikes++
      armed = true
    } else if (armed && s.V < SPIKE_REARM) {
      armed = false
    }
  }
  const measureMs = measureSteps * dt
  return measureMs > 0 ? (spikes / measureMs) * 1000 : 0
}

/** Sweep of firing rate over a range of injected currents. */
export function iFCurve(
  params: HHParams,
  currents: number[],
  opts: IFOptions = {},
): { i: number; rate: number }[] {
  return currents.map((i) => ({ i, rate: firingRate(params, i, opts) }))
}
