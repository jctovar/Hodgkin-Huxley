// Pure canvas drawing for a single oscilloscope panel. Ported from
// legacy HodgkinHuxley.jsx drawScope (L305-393): scrolling trace, oldest on the
// left, newest on the right, with grid, reference marks, title/unit and a
// cheap phosphor halo on the hero trace.

import { MAX_PTS, WINDOW_MS } from '../sim/hh'
import { SCOPE_THEME } from '../styles/theme'

export interface Series {
  data: number[]
  color: string
  w?: number
  /** draw a soft wider halo behind the trace (used for the Vₘ hero trace) */
  glow?: boolean
}

export interface ScopeMark {
  y: number
  label?: string
  c: string
  dash?: boolean
}

export interface ScopeOptions {
  title?: string
  unit?: string
  zero?: number
  marks?: ScopeMark[]
}

const PAD_L = 46
const PAD_R = 10
const PAD_T = 18
const PAD_B = 16

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(1)
}

export function drawScope(
  canvas: HTMLCanvasElement | null,
  series: Series[],
  range: [number, number],
  opts: ScopeOptions = {},
): void {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth || 600
  const cssH = canvas.clientHeight || 160
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const W = cssW
  const H = cssH
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const [ymin, ymax] = range

  const xOf = (i: number) => PAD_L + (i / (MAX_PTS - 1)) * plotW
  const yOf = (v: number) => PAD_T + (1 - (v - ymin) / (ymax - ymin)) * plotH

  ctx.clearRect(0, 0, W, H)

  // grid
  ctx.strokeStyle = SCOPE_THEME.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let gx = 0; gx <= WINDOW_MS; gx += 10) {
    const x = PAD_L + (gx / WINDOW_MS) * plotW
    ctx.moveTo(x, PAD_T)
    ctx.lineTo(x, PAD_T + plotH)
  }
  const yTicks = 4
  ctx.fillStyle = SCOPE_THEME.muted
  ctx.font = "10px 'JetBrains Mono', ui-monospace, monospace"
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = 0; i <= yTicks; i++) {
    const v = ymin + (i / yTicks) * (ymax - ymin)
    const y = yOf(v)
    ctx.moveTo(PAD_L, y)
    ctx.lineTo(PAD_L + plotW, y)
    ctx.fillText(formatTick(v), PAD_L - 6, y)
  }
  ctx.stroke()

  // reference marks
  for (const mk of opts.marks ?? []) {
    const y = yOf(mk.y)
    ctx.strokeStyle = mk.c
    ctx.lineWidth = 1
    ctx.setLineDash(mk.dash ? [4, 4] : [])
    ctx.beginPath()
    ctx.moveTo(PAD_L, y)
    ctx.lineTo(PAD_L + plotW, y)
    ctx.stroke()
    ctx.setLineDash([])
  }
  if (opts.zero !== undefined && (opts.marks ?? []).every((m) => m.y !== opts.zero)) {
    const y = yOf(opts.zero)
    ctx.strokeStyle = 'rgba(140,160,170,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PAD_L, y)
    ctx.lineTo(PAD_L + plotW, y)
    ctx.stroke()
  }

  // title + unit
  ctx.fillStyle = SCOPE_THEME.ink
  ctx.font = "12px 'Space Grotesk', system-ui, sans-serif"
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(opts.title ?? '', PAD_L, 12)
  ctx.fillStyle = SCOPE_THEME.muted
  ctx.textAlign = 'right'
  ctx.fillText(opts.unit ?? '', PAD_L + plotW, 12)

  // traces (oldest left → newest right, scrolling)
  for (const sr of series) {
    const draw = (width: number, alpha: number) => {
      ctx.strokeStyle = sr.color
      ctx.globalAlpha = alpha
      ctx.lineWidth = width
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < MAX_PTS; i++) {
        const x = xOf(i)
        const y = clamp(yOf(sr.data[i]), PAD_T - 30, PAD_T + plotH + 30)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    if (sr.glow) draw((sr.w ?? 1.6) + 4, 0.16) // cheap phosphor halo
    draw(sr.w ?? 1.6, 1)
    ctx.globalAlpha = 1
  }

  // newest-sample dot
  for (const sr of series) {
    const y = yOf(sr.data[MAX_PTS - 1])
    ctx.fillStyle = sr.color
    ctx.beginPath()
    ctx.arc(PAD_L + plotW, y, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Symmetric auto-range ceiling for the currents panel (legacy behaviour). */
export function currentRange(...arrays: number[][]): [number, number] {
  let mx = 60
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) {
      const a = Math.abs(arr[i])
      if (a > mx) mx = a
    }
  }
  mx = Math.ceil(mx / 100) * 100
  return [-mx, mx]
}
