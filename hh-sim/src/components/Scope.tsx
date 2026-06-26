import { forwardRef, useImperativeHandle, useRef } from 'react'
import { drawScope, type ScopeOptions, type Series } from '../lib/scopeDraw'
import styles from './Scope.module.css'

export interface ScopeHandle {
  draw: (
    series: Series[],
    range: [number, number],
    opts?: ScopeOptions,
  ) => void
}

export interface LegendItem {
  c: string
  t: string
}

interface ScopeProps {
  legend?: LegendItem[]
  /** a11y label for the canvas */
  label?: string
}

/**
 * A single oscilloscope panel. Drawing is imperative: the animation loop holds
 * a ref and calls `ref.draw(...)` each frame so React never re-renders on the
 * hot path (legacy HodgkinHuxley.jsx constraint).
 */
export const Scope = forwardRef<ScopeHandle, ScopeProps>(function Scope(
  { legend, label },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      draw: (series, range, opts) =>
        drawScope(canvasRef.current, series, range, opts),
    }),
    [],
  )

  return (
    <div className={styles.card}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label={label} />
      {legend && legend.length > 0 && (
        <div className={styles.legend}>
          {legend.map((l, i) => (
            <span key={i} className={styles.legItem}>
              <i style={{ background: l.c }} /> {l.t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})
