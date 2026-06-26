import { useEffect, useRef } from 'react'
import styles from './Splash.module.css'

// ── Branding de la pantalla de inicio ────────────────────────────────────────
// Logo institucional: archivo SVG en hh-sim/public/. BASE_URL resuelve la
// subruta correcta en producción (GitHub Pages) y '/' en dev/tests.
export const SPLASH_LOGO_SRC = `${import.meta.env.BASE_URL}iztacala_01.svg`
// Texto de la institución que aparece bajo el título (vacío = no se muestra).
export const SPLASH_INSTITUTION = 'COORDINACIÓN DE EDUCACIÓN A DISTANCIA'
// ─────────────────────────────────────────────────────────────────────────────

const AUTO_DISMISS_MS = 2500

export interface SplashProps {
  onDismiss: () => void
}

/**
 * Pantalla de inicio institucional. Overlay a pantalla completa que se cierra
 * sola (AUTO_DISMISS_MS) o con clic / Enter / Escape. Se muestra en cada carga
 * (sin localStorage). El bucle de simulación sigue corriendo debajo.
 */
export function Splash({ onDismiss }: SplashProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [onDismiss])

  return (
    <div
      ref={ref}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Pantalla de inicio"
      tabIndex={-1}
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') onDismiss()
      }}
    >
      <div className={styles.content}>
        <img className={styles.logo} src={SPLASH_LOGO_SRC} alt="Logo institucional" />
        <h1 className={styles.title}>Potencial de acción de una neurona</h1>
        {SPLASH_INSTITUTION ? (
          <p className={styles.institution}>{SPLASH_INSTITUTION}</p>
        ) : null}
        <p className={styles.hint}>Pulsa o espera para continuar</p>
      </div>
    </div>
  )
}
