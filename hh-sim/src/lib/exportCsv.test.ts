import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportCsv, samplesToCsv } from './exportCsv'
import type { Sample } from '../sim/types'

const samples: Sample[] = [
  { t: 0.1, V: -65.0, m: 0.0529, h: 0.596, n: 0.318, iNa: -1.22, iK: 4.42, iL: -3.18 },
  { t: 0.2, V: -64.8, m: 0.0535, h: 0.595, n: 0.3185, iNa: -1.18, iK: 4.4, iL: -3.16 },
]

describe('samplesToCsv', () => {
  it('emits the header t,V,m,h,n,iNa,iK,iL and one row per sample', () => {
    const csv = samplesToCsv(samples)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('t,V,m,h,n,iNa,iK,iL')
    expect(lines).toHaveLength(1 + samples.length)
  })

  it('formats numbers with 6 decimals and a dot separator (locale-independent)', () => {
    const csv = samplesToCsv(samples)
    expect(csv).toContain('-65.000000')
    expect(csv).toContain('0.052900')
    // every numeric field carries a dot decimal (toFixed(6)), never a decimal comma
    const dataLines = csv.split('\n').slice(1)
    for (const line of dataLines) {
      for (const field of line.split(',')) {
        expect(field).toMatch(/^-?\d+\.\d{6}$/)
      }
    }
  })
})

describe('exportCsv', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:fake-url')
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds a blob, triggers a download and revokes the URL', () => {
    const click = vi.fn()
    const anchor = { href: '', download: '', click, remove: vi.fn() }
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return anchor as unknown as HTMLAnchorElement
      return realCreate(tag)
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as never)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as never)

    exportCsv(samples, 'test.csv')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(anchor.download).toBe('test.csv')
    expect(anchor.href).toBe('blob:fake-url')
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')

    vi.restoreAllMocks()
  })

  it('uses the default filename when none is given', () => {
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'a' ? (anchor as unknown as HTMLAnchorElement) : realCreate(tag),
    )
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as never)

    exportCsv(samples)
    expect(anchor.download).toBe('hh_sim.csv')

    vi.restoreAllMocks()
  })
})
