import { C } from '../styles/theme'
import type { ControlState } from '../sim/presets'
import type { Preset } from '../sim/presets'
import type { IntegratorMethod, StimulusProtocol } from '../sim/types'
import styles from './Controls.module.css'

const DT_OPTIONS = [0.005, 0.01, 0.025, 0.05] as const
const METHOD_OPTIONS: { value: IntegratorMethod; label: string }[] = [
  { value: 'euler', label: 'Euler' },
  { value: 'rk4', label: 'RK4 (4.º orden)' },
]
const PROTOCOL_OPTIONS: { value: StimulusProtocol; label: string }[] = [
  { value: 'step', label: 'Escalón' },
  { value: 'train', label: 'Tren de pulsos' },
  { value: 'ramp', label: 'Rampa' },
]

interface SliderProps {
  label: React.ReactNode
  sub?: string
  unit: string
  min: number
  max: number
  step: number
  value: number
  color: string
  onChange: (v: number) => void
}

function Slider({ label, sub, unit, min, max, step, value, color, onChange }: SliderProps) {
  return (
    <div className={styles.slider}>
      <div className={styles.sliderHead}>
        <span className={styles.sliderLabel}>
          {label}
          {sub ? <em className={styles.sub}> · {sub}</em> : null}
        </span>
        <span className={styles.sliderVal} style={{ color }}>
          {value}
          <small className={styles.unit}> {unit}</small>
        </span>
      </div>
      <input
        type="range"
        className={styles.rng}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ accentColor: color }}
        aria-label={typeof label === 'string' ? label : undefined}
      />
    </div>
  )
}

export interface ControlsProps {
  control: ControlState
  running: boolean
  recording: boolean
  phi: number
  presets: Record<string, Preset>
  onPatch: (patch: Partial<ControlState>) => void
  onToggleRun: () => void
  onReset: () => void
  onFirePulse: () => void
  onPreset: (key: string) => void
  onToggleRecord: () => void
  onExportCsv: () => void
}

export function Controls({
  control,
  running,
  recording,
  phi,
  presets,
  onPatch,
  onToggleRun,
  onReset,
  onFirePulse,
  onPreset,
  onToggleRecord,
  onExportCsv,
}: ControlsProps) {
  return (
    <aside className={styles.panel}>
      <div className={styles.row}>
        <button
          className={`btn primary ${styles.flex1}`}
          onClick={onToggleRun}
        >
          {running ? '❚❚ Pausar' : '▶ Reanudar'}
        </button>
        <button className="btn" onClick={onReset}>
          ↺ Reiniciar
        </button>
      </div>

      <button className="btn pulse" onClick={onFirePulse}>
        ⚡ Inyectar pulso (estímulo breve)
      </button>

      <Slider
        label="Corriente inyectada  I"
        sub="estímulo continuo"
        unit="µA/cm²"
        min={-5}
        max={25}
        step={0.5}
        value={control.iStim}
        color={C.stim}
        onChange={(v) => onPatch({ iStim: v })}
      />
      <Slider
        label="Conductancia máx. Na⁺  ḡNa"
        unit="mS/cm²"
        min={0}
        max={200}
        step={1}
        value={control.gNa}
        color={C.na}
        onChange={(v) => onPatch({ gNa: v })}
      />
      <Slider
        label="Conductancia máx. K⁺  ḡK"
        unit="mS/cm²"
        min={0}
        max={80}
        step={1}
        value={control.gK}
        color={C.k}
        onChange={(v) => onPatch({ gK: v })}
      />
      <Slider
        label="Temperatura  T"
        sub={`φ = ${phi.toFixed(2)}×`}
        unit="°C"
        min={2}
        max={32}
        step={0.5}
        value={control.temp}
        color={C.leak}
        onChange={(v) => onPatch({ temp: v })}
      />

      <div className={styles.advanced}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="hh-protocol">
            Estímulo
          </label>
          <select
            id="hh-protocol"
            className={styles.select}
            value={control.protocol}
            onChange={(e) => onPatch({ protocol: e.target.value as StimulusProtocol })}
          >
            {PROTOCOL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="hh-method">
            Integrador
          </label>
          <select
            id="hh-method"
            className={styles.select}
            value={control.method}
            onChange={(e) => onPatch({ method: e.target.value as IntegratorMethod })}
          >
            {METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="hh-dt">
            Δt (ms)
          </label>
          <select
            id="hh-dt"
            className={styles.select}
            value={control.dt}
            onChange={(e) => onPatch({ dt: parseFloat(e.target.value) })}
          >
            {DT_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d.toFixed(3)}
              </option>
            ))}
          </select>
        </div>
        {control.method === 'euler' && control.dt >= 0.05 && (
          <p className={styles.warn}>Δt grande con Euler puede ser inestable.</p>
        )}
      </div>

      <div className={styles.presetLabel}>Escenarios</div>
      <div className={styles.presets}>
        {Object.entries(presets).map(([k, p]) => (
          <button
            key={k}
            className="btn chip-btn"
            onClick={() => onPreset(k)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={styles.row}>
        <button className={`btn ${recording ? 'rec' : ''}`} onClick={onToggleRecord}>
          {recording ? '■ Detener' : '● Grabar'}
        </button>
        <button className="btn" onClick={onExportCsv}>
          ⤓ Exportar CSV
        </button>
      </div>
    </aside>
  )
}
