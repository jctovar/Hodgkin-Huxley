import { forwardRef, useImperativeHandle, useRef } from 'react'
import { nInf } from '../sim/hh'
import { SCOPE_THEME } from '../styles/theme'
import styles from './PhasePlane.module.css'

export interface PhasePlaneHandle {
  /** Draw the (Vₘ, n) trajectory. Both arrays have equal length (MAX_PTS). */
  draw: (V: number[], n: number[]) => void
}

const PAD_L = 46
const PAD_R = 14
const PAD_T = 18
const PAD_B = 30
const V_MIN = -90
const V_MAX = 50
const N_MIN = 0
const N_MAX = 1

export const PhasePlane = forwardRef<PhasePlaneHandle>(function PhasePlane(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      draw: (V, n) => drawPhasePlane(canvasRef.current, V, n),
    }),
    [],
  )

  return (
    <div className={styles.card}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Plano de fase Vₘ–n" />
    </div>
  )
})

function drawPhasePlane(
  canvas: HTMLCanvasElement | null,
  V: number[],
  n: number[],
): void {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth || 600
  const cssH = canvas.clientHeight || 200
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const W = cssW
  const H = cssH
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B

  const xOf = (v: number) => PAD_L + ((v - V_MIN) / (V_MAX - V_MIN)) * plotW
  const yOf = (nv: number) => PAD_T + (1 - (nv - N_MIN) / (N_MAX - N_MIN)) * plotH

  ctx.clearRect(0, 0, W, H)

  // grid
  ctx.strokeStyle = SCOPE_THEME.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let v = -80; v <= 40; v += 20) {
    const x = xOf(v)
    ctx.moveTo(x, PAD_T)
    ctx.lineTo(x, PAD_T + plotH)
  }
  for (let i = 0; i <= 4; i++) {
    const y = PAD_T + (i / 4) * plotH
    ctx.moveTo(PAD_L, y)
    ctx.lineTo(PAD_L + plotW, y)
  }
  ctx.stroke()

  // n-nullcline: n = n∞(V) — where dn/dt = 0
  ctx.strokeStyle = 'rgba(167,139,250,0.5)'
  ctx.setLineDash([5, 5])
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let v = V_MIN; v <= V_MAX; v += 1) {
    const x = xOf(v)
    const y = yOf(nInf(v))
    if (v === V_MIN) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.setLineDash([])

  // trajectory with fading trail (oldest dim → newest bright)
  const len = V.length
  ctx.lineWidth = 1.8
  ctx.lineJoin = 'round'
  for (let i = 1; i < len; i++) {
    ctx.globalAlpha = 0.08 + 0.92 * (i / len)
    ctx.strokeStyle = '#34c8b6'
    ctx.beginPath()
    ctx.moveTo(xOf(V[i - 1]), yOf(n[i - 1]))
    ctx.lineTo(xOf(V[i]), yOf(n[i]))
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // current point
  const last = len - 1
  ctx.fillStyle = '#ffd166'
  ctx.beginPath()
  ctx.arc(xOf(V[last]), yOf(n[last]), 3.2, 0, Math.PI * 2)
  ctx.fill()

  // axis labels
  ctx.fillStyle = SCOPE_THEME.ink
  ctx.font = "12px 'Space Grotesk', system-ui, sans-serif"
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Plano de fase  Vₘ – n', PAD_L, 12)
  ctx.fillStyle = SCOPE_THEME.muted
  ctx.font = "10px 'JetBrains Mono', ui-monospace, monospace"
  ctx.textAlign = 'center'
  ctx.fillText('Vₘ (mV)', PAD_L + plotW / 2, H - 8)
  ctx.save()
  ctx.translate(12, PAD_T + plotH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('n', 0, 0)
  ctx.restore()
}
