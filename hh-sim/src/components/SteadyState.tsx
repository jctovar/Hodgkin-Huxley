import { useEffect, useRef } from 'react'
import { hInf, mInf, nInf, tauH, tauM, tauN } from '../sim/hh'
import { C, SCOPE_THEME } from '../styles/theme'
import styles from './SteadyState.module.css'

const PAD_L = 40
const PAD_R = 12
const PAD_T = 18
const PAD_B = 22
const V_MIN = -100
const V_MAX = 50

/** Educational panel: steady-state gates x∞(V) (0–1) and time constants τ(V) (ms). */
export function SteadyState() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const draw = () => paint(canvasRef.current)
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])

  return (
    <div className={styles.card}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Curvas estacionarias de activación" />
      <div className={styles.legend}>
        <span><i style={{ background: C.na }} /> m∞</span>
        <span><i style={{ background: C.hGate }} /> h∞</span>
        <span><i style={{ background: C.k }} /> n∞</span>
        <span className={styles.dash}>τ (ms)</span>
      </div>
    </div>
  )
}

function paint(canvas: HTMLCanvasElement | null) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth || 600
  const cssH = canvas.clientHeight || 180
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
  const yGate = (g: number) => PAD_T + (1 - g) * plotH

  ctx.clearRect(0, 0, W, H)

  // grid + 0–1 axis ticks for gates
  ctx.strokeStyle = SCOPE_THEME.grid
  ctx.fillStyle = SCOPE_THEME.muted
  ctx.font = "10px 'JetBrains Mono', monospace"
  ctx.lineWidth = 1
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.beginPath()
  for (let i = 0; i <= 4; i++) {
    const y = PAD_T + (i / 4) * plotH
    ctx.moveTo(PAD_L, y)
    ctx.lineTo(PAD_L + plotW, y)
    ctx.fillText((1 - i / 4).toFixed(1), PAD_L - 6, y)
  }
  ctx.stroke()

  // τ(V): compute max for scaling, draw dashed
  let tauMax = 0
  for (let v = V_MIN; v <= V_MAX; v++) tauMax = Math.max(tauMax, tauM(v), tauH(v), tauN(v))
  const yTau = (t: number) => PAD_T + (1 - t / tauMax) * plotH
  const drawTau = (fn: (v: number) => number, color: string) => {
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.7
    ctx.setLineDash([3, 3])
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let v = V_MIN; v <= V_MAX; v++) {
      const x = xOf(v)
      const y = yTau(fn(v))
      if (v === V_MIN) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
  }

  // steady-state gates (solid)
  const drawGate = (fn: (v: number) => number, color: string) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let v = V_MIN; v <= V_MAX; v++) {
      const x = xOf(v)
      const y = yGate(fn(v))
      if (v === V_MIN) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  drawGate(mInf, C.na)
  drawGate(hInf, C.hGate)
  drawGate(nInf, C.k)
  drawTau(tauM, C.na)
  drawTau(tauH, C.hGate)
  drawTau(tauN, C.k)

  // title + x-axis label
  ctx.fillStyle = SCOPE_THEME.ink
  ctx.font = "12px 'Space Grotesk', system-ui, sans-serif"
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Activación en estado estacionario  x∞(V) · τ(V)', PAD_L, 12)
  ctx.fillStyle = SCOPE_THEME.muted
  ctx.font = "10px 'JetBrains Mono', monospace"
  ctx.textAlign = 'center'
  ctx.fillText('Vₘ (mV)', PAD_L + plotW / 2, H - 6)
}
