import { describe, it, expect } from 'vitest'
import { euler, rk4 } from './integrators'
import { phiFor, restingState } from './hh'
import type { HHParams, HHState } from './types'

const params: HHParams = { gNa: 120, gK: 36, gL: 0.3, temp: 6.3, iStim: 0 }

/** Integrate from rest under a held stimulus; return (times[], V[]) at sample dt. */
function trajectory(
  method: (s: HHState, p: HHParams, phi: number, iExt: number, dt: number) => HHState,
  dt: number,
  durationMs: number,
  iExt: number,
  sampleEvery = 0.1,
): { t: number[]; V: number[] } {
  const phi = phiFor(params.temp)
  let s = restingState()
  const t: number[] = [0]
  const V: number[] = [s.V]
  const total = Math.round(durationMs / dt)
  const every = Math.max(1, Math.round(sampleEvery / dt))
  let time = 0
  for (let i = 1; i <= total; i++) {
    s = method(s, params, phi, iExt, dt)
    time += dt
    if (i % every === 0) {
      t.push(time)
      V.push(s.V)
    }
  }
  return { t, V }
}

function peak(t: number[], V: number[]): { v: number; time: number } {
  let vi = 0
  for (let i = 1; i < V.length; i++) if (V[i] > V[vi]) vi = i
  return { v: V[vi], time: t[vi] }
}

describe('integrator agreement', () => {
  it('euler and rk4 converge to the same trajectory at a tiny shared dt', () => {
    const dt = 0.001
    const e = trajectory(euler, dt, 10, 20)
    const r = trajectory(rk4, dt, 10, 20)
    // compare at matching sample points
    const n = Math.min(e.V.length, r.V.length)
    let maxDiff = 0
    for (let i = 0; i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(e.V[i] - r.V[i]))
    expect(maxDiff).toBeLessThan(0.5) // mV — both resolve the same AP at dt=0.001
  })
})

describe('RK4 accuracy vs Euler (DEVELOPMENT.md §4.1 acceptance)', () => {
  it('RK4 @ dt=0.025 matches Euler @ dt=0.01 within ±0.5 mV at the AP peak', () => {
    const e = trajectory(euler, 0.01, 12, 20)
    const r = trajectory(rk4, 0.025, 12, 20)
    const pe = peak(e.t, e.V)
    const pr = peak(r.t, r.V)
    // amplitude: peak voltage agrees within 0.5 mV
    expect(Math.abs(pe.v - pr.v)).toBeLessThan(0.5)
    // timing: first-spike peak occurs at nearly the same time
    expect(Math.abs(pe.time - pr.time)).toBeLessThan(0.1) // ms
  })

  it('both methods actually spike past 0 mV under a suprathreshold stimulus', () => {
    const e = trajectory(euler, 0.01, 10, 20)
    const r = trajectory(rk4, 0.025, 10, 20)
    expect(Math.max(...e.V)).toBeGreaterThan(0)
    expect(Math.max(...r.V)).toBeGreaterThan(0)
  })

  it('RK4 stays stable at a larger dt where it is still well-resolved', () => {
    // run a full AP + recovery; ensure V stays bounded (no NaN/explosion)
    const r = trajectory(rk4, 0.05, 30, 10)
    const finite = r.V.every((v) => Number.isFinite(v))
    expect(finite).toBe(true)
    expect(Math.max(...r.V)).toBeLessThan(100) // mV, sane upper bound
  })
})

describe('action-potential shape regression', () => {
  it('produces a well-formed spike: overshoot > +20 mV and AHP below rest', () => {
    const e = trajectory(euler, 0.01, 30, 15)
    const peak = Math.max(...e.V)
    expect(peak).toBeGreaterThan(20) // mV overshoot
    // after the peak, the trace hyperpolarizes below the resting −65 mV
    const peakIdx = e.V.indexOf(peak)
    const ahp = Math.min(...e.V.slice(peakIdx))
    expect(ahp).toBeLessThan(-70) // mV afterhyperpolarization
  })
})
