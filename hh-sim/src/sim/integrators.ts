// Step integrators for the HH system. Pure, React-free, easy to unit-test.
// euler is the legacy method; rk4 (4th-order Runge–Kutta) is added for higher
// accuracy at larger dt (DEVELOPMENT.md §4.1).

import { deriv } from './hh'
import type { Deriv, HHState, Integrator, IntegratorMethod } from './types'

/** state + derivative·h  (componentwise). */
function addScaled(s: HHState, d: Deriv, h: number): HHState {
  return {
    V: s.V + d.dV * h,
    m: s.m + d.dm * h,
    h: s.h + d.dh * h,
    n: s.n + d.dn * h,
  }
}

/** Forward Euler: one step. iExt is held constant across the step. */
export const euler: Integrator = (s, p, phi, iExt, dt) => {
  return addScaled(s, deriv(s, p, phi, iExt), dt)
}

/**
 * Classic 4th-order Runge–Kutta. iExt (and φ, params) are held constant across
 * the four derivative evaluations, which is correct for a held stimulus.
 */
export const rk4: Integrator = (s, p, phi, iExt, dt) => {
  const k1 = deriv(s, p, phi, iExt)
  const k2 = deriv(addScaled(s, k1, dt / 2), p, phi, iExt)
  const k3 = deriv(addScaled(s, k2, dt / 2), p, phi, iExt)
  const k4 = deriv(addScaled(s, k3, dt), p, phi, iExt)
  return {
    V: s.V + (dt / 6) * (k1.dV + 2 * k2.dV + 2 * k3.dV + k4.dV),
    m: s.m + (dt / 6) * (k1.dm + 2 * k2.dm + 2 * k3.dm + k4.dm),
    h: s.h + (dt / 6) * (k1.dh + 2 * k2.dh + 2 * k3.dh + k4.dh),
    n: s.n + (dt / 6) * (k1.dn + 2 * k2.dn + 2 * k3.dn + k4.dn),
  }
}

export const INTEGRATORS: Record<IntegratorMethod, Integrator> = {
  euler,
  rk4,
}
