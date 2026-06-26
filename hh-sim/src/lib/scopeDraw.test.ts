import { describe, it, expect } from 'vitest'
import { drawScope, currentRange, type Series } from './scopeDraw'
import { MAX_PTS } from '../sim/hh'

function trace(fill = 0): Series {
  return { data: new Array(MAX_PTS).fill(fill), color: '#ffd166' }
}

describe('currentRange', () => {
  it('returns a symmetric range with a floor of ±100', () => {
    expect(currentRange([0, 1, -2], [3, -4])).toEqual([-100, 100])
  })

  it('rounds the peak magnitude up to the next 100 and stays symmetric', () => {
    expect(currentRange([0, 150, -10])).toEqual([-200, 200])
    expect(currentRange([-260])).toEqual([-300, 300])
  })

  it('handles no arrays by falling back to the floor', () => {
    expect(currentRange()).toEqual([-100, 100])
  })
})

describe('drawScope', () => {
  const canvas = () => document.createElement('canvas')

  it('no-ops on a null canvas', () => {
    expect(() => drawScope(null, [trace()], [-90, 55])).not.toThrow()
  })

  it('paints a full panel (title, unit, glow, marks, zero line) without throwing', () => {
    expect(() =>
      drawScope(
        canvas(),
        [
          { data: new Array(MAX_PTS).fill(-65), color: '#ffd166', w: 2, glow: true },
          { data: new Array(MAX_PTS).fill(10), color: '#06d6a0', w: 1.4 },
        ],
        [-90, 55],
        {
          title: 'Vₘ',
          unit: 'mV',
          zero: 0,
          marks: [
            { y: 0, label: '0', c: '#888' },
            { y: -55, label: 'umbral', c: '#fc6', dash: true },
          ],
        },
      ),
    ).not.toThrow()
  })

  it('skips the implicit zero line when a mark already sits on zero', () => {
    expect(() =>
      drawScope(canvas(), [trace()], [-1, 1], { zero: 0, marks: [{ y: 0, c: '#888' }] }),
    ).not.toThrow()
  })

  it('clamps off-range samples and formats large/decimal ticks', () => {
    // values far outside [ymin,ymax] exercise the clamp; a >1000 range exercises
    // the 'k' tick formatter, a fractional one the toFixed(1) branch.
    expect(() =>
      drawScope(canvas(), [trace(99999)], [-1500, 1500], { title: 't' }),
    ).not.toThrow()
    expect(() => drawScope(canvas(), [trace(0.25)], [0, 0.5])).not.toThrow()
  })
})
