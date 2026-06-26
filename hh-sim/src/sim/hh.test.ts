import { describe, it, expect } from 'vitest'
import {
  alphaM,
  alphaN,
  alphaH,
  betaM,
  betaN,
  betaH,
  mInf,
  hInf,
  nInf,
  phiFor,
  restingState,
  currents,
  deriv,
  crossedUpward,
  rearmAbove,
  Cm,
  Q10,
  T_REF,
} from './hh'
import { euler } from './integrators'
import { DEFAULT_CONTROL } from './presets'
import type { HHParams } from './types'

const restParams: HHParams = {
  gNa: 120,
  gK: 36,
  gL: 0.3,
  temp: 6.3,
  iStim: 0,
}

describe('gating rates', () => {
  it('alphaN uses its analytic limit 0.1 at the V=−55 singularity', () => {
    expect(alphaN(-55)).toBeCloseTo(0.1, 10)
  })

  it('alphaM uses its analytic limit 1.0 at the V=−40 singularity', () => {
    expect(alphaM(-40)).toBeCloseTo(1.0, 10)
  })

  it('rates are continuous across the singularities', () => {
    // tiny perturbations should land near the analytic limit, not blow up
    expect(alphaN(-55 + 1e-4)).toBeCloseTo(0.1, 3)
    expect(alphaM(-40 + 1e-4)).toBeCloseTo(1.0, 3)
    expect(alphaN(-55 - 1e-4)).toBeCloseTo(0.1, 3)
    expect(alphaM(-40 - 1e-4)).toBeCloseTo(1.0, 3)
  })

  it('all six rates are strictly positive across the physiological range', () => {
    for (let V = -100; V <= 50; V += 5) {
      expect(alphaN(V)).toBeGreaterThan(0)
      expect(betaN(V)).toBeGreaterThan(0)
      expect(alphaM(V)).toBeGreaterThan(0)
      expect(betaM(V)).toBeGreaterThan(0)
      expect(alphaH(V)).toBeGreaterThan(0)
      expect(betaH(V)).toBeGreaterThan(0)
    }
  })
})

describe('steady-state gates and temperature factor', () => {
  it('x∞ gates stay within [0, 1] across the voltage range', () => {
    for (let V = -100; V <= 50; V += 5) {
      for (const x of [mInf(V), hInf(V), nInf(V)]) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(1)
      }
    }
  })

  it('φ equals 1 at T_ref and scales by Q10 every 10 °C', () => {
    expect(phiFor(T_REF)).toBe(1)
    expect(phiFor(T_REF + 10)).toBeCloseTo(Q10, 6)
    expect(phiFor(T_REF + 20)).toBeCloseTo(Q10 * Q10, 6)
    expect(phiFor(T_REF - 10)).toBeCloseTo(1 / Q10, 6)
  })
})

describe('resting state', () => {
  it('initializes at −65 mV with gating variables in (0, 1)', () => {
    const s = restingState()
    expect(s.V).toBe(-65)
    for (const g of [s.m, s.h, s.n]) {
      expect(g).toBeGreaterThan(0)
      expect(g).toBeLessThan(1)
    }
  })

  it('rest is a near-equilibrium: the net current (hence dV) is tiny', () => {
    const s = restingState()
    const c = currents(s, restParams)
    const net = c.iNa + c.iK + c.iL
    expect(Math.abs(net)).toBeLessThan(0.5) // µA/cm²
    const d = deriv(s, restParams, phiFor(restParams.temp), 0)
    expect(Math.abs(d.dV)).toBeLessThan(0.5) // mV/ms
  })
})

describe('currents and derivative consistency', () => {
  it('inward Na⁺ current is negative; K⁺ and leak are outward (positive) at V=0', () => {
    const c = currents({ V: 0, m: 0.5, h: 0.5, n: 0.5 }, restParams)
    expect(c.iNa).toBeLessThan(0)
    expect(c.iK).toBeGreaterThan(0)
    expect(c.iL).toBeGreaterThan(0)
  })

  it('deriv.dV matches Cm·dV/dt = iExt − iNa − iK − iL exactly', () => {
    const s = { V: -20, m: 0.3, h: 0.6, n: 0.4 }
    const c = currents(s, restParams)
    const iExt = 7
    const d = deriv(s, restParams, phiFor(restParams.temp), iExt)
    expect(d.dV).toBeCloseTo((iExt - c.iNa - c.iK - c.iL) / Cm, 10)
  })
})

describe('numerical stability and excitability', () => {
  it('stays near rest with no stimulus (no spontaneous runaway)', () => {
    let s = restingState()
    const phi = phiFor(restParams.temp)
    for (let i = 0; i < 2000; i++) s = euler(s, restParams, phi, 0, 0.01) // 20 ms
    expect(s.V).toBeGreaterThan(-70)
    expect(s.V).toBeLessThan(-60)
  })

  it('fires an action potential (V crosses 0 mV) under a strong stimulus', () => {
    let s = restingState()
    const phi = phiFor(restParams.temp)
    let peak = -Infinity
    for (let i = 0; i < 1000; i++) {
      // 10 ms of 20 µA/cm² continuous current
      s = euler(s, restParams, phi, 20, 0.01)
      peak = Math.max(peak, s.V)
    }
    expect(peak).toBeGreaterThan(0) // spikes past 0 mV
  })
})

describe('spike detection helpers', () => {
  it('counts a single upward crossing of 0 mV', () => {
    expect(crossedUpward(-1, 5)).toBe(true)
    expect(crossedUpward(5, 10)).toBe(false) // already above
    expect(crossedUpward(5, -1)).toBe(false) // downward
  })

  it('re-arms only after the trace drops below −10 mV', () => {
    let armed = true
    armed = rearmAbove(armed, -5) // still above re-arm level
    expect(armed).toBe(true)
    armed = rearmAbove(armed, -11) // drops below → re-arm
    expect(armed).toBe(false)
  })
})

describe('presets', () => {
  it('DEFAULT_CONTROL matches legacy initial values', () => {
    expect(DEFAULT_CONTROL).toMatchObject({
      gNa: 120,
      gK: 36,
      gL: 0.3,
      temp: 6.3,
      iStim: 0,
      method: 'euler',
      dt: 0.01,
    })
  })
})
