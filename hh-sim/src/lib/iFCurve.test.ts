import { describe, it, expect } from 'vitest'
import { firingRate, iFCurve } from './iFCurve'
import type { HHParams } from '../sim/types'

const base: HHParams = { gNa: 120, gK: 36, gL: 0.3, temp: 6.3, iStim: 0 }

describe('firingRate', () => {
  it('is silent (0 Hz) at rest with no current', () => {
    expect(firingRate(base, 0)).toBe(0)
  })

  it('fires (rate > 0) under a suprathreshold current', () => {
    expect(firingRate(base, 20)).toBeGreaterThan(0)
  })

  it('has a threshold: subthreshold currents stay silent', () => {
    expect(firingRate(base, 6)).toBe(0) // below rheobase
    expect(firingRate(base, 12)).toBeGreaterThan(0) // above rheobase
  })

  it('increases its firing rate with temperature (higher φ)', () => {
    const cool = firingRate({ ...base, temp: 6.3 }, 18)
    const warm = firingRate({ ...base, temp: 20 }, 18)
    expect(warm).toBeGreaterThan(cool)
  })

  it('goes silent when Na⁺ conductance is largely blocked (TTX-like)', () => {
    expect(firingRate({ ...base, gNa: 5 }, 20)).toBe(0)
  })
})

describe('iFCurve sweep', () => {
  it('returns one point per input current and is monotonic over the rising part', () => {
    const currents = [0, 4, 8, 12, 16, 20]
    const pts = iFCurve(base, currents, { duration: 400, settle: 100 })
    expect(pts).toHaveLength(currents.length)
    expect(pts[0].rate).toBe(0) // at rest
    // beyond threshold the curve does not decrease overall
    const firing = pts.filter((p) => p.rate > 0).map((p) => p.rate)
    const nonDecreasing = firing.every((r, i) => i === 0 || r >= firing[i - 1] - 5)
    expect(nonDecreasing).toBe(true)
  })
})
