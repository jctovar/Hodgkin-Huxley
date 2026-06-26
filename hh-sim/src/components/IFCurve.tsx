import { useEffect, useState } from 'react'
import { iFCurve } from '../lib/iFCurve'
import { C, SCOPE_THEME } from '../styles/theme'
import type { HHParams } from '../sim/types'
import styles from './IFCurve.module.css'

const PAD_L = 40
const PAD_R = 12
const PAD_T = 18
const PAD_B = 24
const CURRENTS = Array.from({ length: 21 }, (_, i) => i * 1.5) // 0 .. 30 µA/cm²

export function IFCurve({ params }: { params: HHParams }) {
  const [points, setPoints] = useState<{ i: number; rate: number }[]>([])

  useEffect(() => {
    // debounce so dragging a slider doesn't recompute on every keystroke
    const id = setTimeout(() => {
      setPoints(iFCurve(params, CURRENTS, { duration: 400, settle: 100 }))
    }, 250)
    return () => clearTimeout(id)
  }, [params])

  return (
    <div className={styles.card}>
      <canvas
        ref={(el) => {
          if (el) paint(el, points)
        }}
        className={styles.canvas}
        aria-label="Curva frecuencia–corriente (I–F)"
      />
    </div>
  )
}

function paint(canvas: HTMLCanvasElement, points: { i: number; rate: number }[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth || 600
  const cssH = canvas.clientHeight || 170
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const W = cssW
  const H = cssH
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B

  const iMax = CURRENTS[CURRENTS.length - 1]
  const rMax = Math.max(10, ...points.map((p) => p.rate))
  const xOf = (i: number) => PAD_L + (i / iMax) * plotW
  const yOf = (r: number) => PAD_T + (1 - r / rMax) * plotH

  ctx.clearRect(0, 0, W, H)

  // grid
  ctx.strokeStyle = SCOPE_THEME.grid
  ctx.fillStyle = SCOPE_THEME.muted
  ctx.font = "10px 'JetBrains Mono', monospace"
  ctx.lineWidth = 1
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.beginPath()
  for (let k = 0; k <= 4; k++) {
    const y = PAD_T + (k / 4) * plotH
    ctx.moveTo(PAD_L, y)
    ctx.lineTo(PAD_L + plotW, y)
    ctx.fillText((rMax * (1 - k / 4)).toFixed(0), PAD_L - 6, y)
  }
  ctx.stroke()

  // curve
  if (points.length > 1) {
    ctx.strokeStyle = C.stim
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.beginPath()
    points.forEach((p, idx) => {
      const x = xOf(p.i)
      const y = yOf(p.rate)
      if (idx === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }

  // title + axis labels
  ctx.fillStyle = SCOPE_THEME.ink
  ctx.font = "12px 'Space Grotesk', system-ui, sans-serif"
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Curva I–F  (frecuencia vs corriente)', PAD_L, 12)
  ctx.fillStyle = SCOPE_THEME.muted
  ctx.font = "10px 'JetBrains Mono', monospace"
  ctx.textAlign = 'center'
  ctx.fillText('I (µA/cm²)', PAD_L + plotW / 2, H - 6)
  ctx.save()
  ctx.translate(12, PAD_T + plotH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('Hz', 0, 0)
  ctx.restore()
}
