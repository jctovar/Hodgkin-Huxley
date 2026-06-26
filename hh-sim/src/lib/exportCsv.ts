// CSV export of simulation samples (DEVELOPMENT.md §4.2). Locale-independent:
// fixed 6-decimal places, dot decimal separator, header t,V,m,h,n,iNa,iK,iL.

import type { Sample } from '../sim/types'

const HEADER = 't,V,m,h,n,iNa,iK,iL'

export function samplesToCsv(samples: Sample[]): string {
  const rows = samples.map((s) =>
    [s.t, s.V, s.m, s.h, s.n, s.iNa, s.iK, s.iL]
      .map((x) => x.toFixed(6))
      .join(','),
  )
  return [HEADER, ...rows].join('\n')
}

export function exportCsv(samples: Sample[], filename = 'hh_sim.csv'): void {
  const blob = new Blob([samplesToCsv(samples)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
