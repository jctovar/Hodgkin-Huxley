import type { ReactNode } from 'react'
import { useSimulation } from './hooks/useSimulation'
import { Scope } from './components/Scope'
import { PhasePlane } from './components/PhasePlane'
import { SteadyState } from './components/SteadyState'
import { IFCurve } from './components/IFCurve'
import { Controls } from './components/Controls'
import { Readouts } from './components/Readouts'
import { PRESETS } from './sim/presets'
import { C } from './styles/theme'
import { EK, EL, ENa, WINDOW_MS } from './sim/hh'
import styles from './App.module.css'

function Chip({ label, value, color }: { label: string; value: ReactNode; color: string }) {
  return (
    <div className={styles.chip}>
      <span className={styles.chipLabel}>{label}</span>
      <span className={styles.chipVal} style={{ color }}>
        {value}
      </span>
    </div>
  )
}

export default function App() {
  const {
    control,
    running,
    readout,
    phi,
    recording,
    vmRef,
    iRef,
    gRef,
    patchControl,
    toggleRun,
    reset,
    firePulse,
    applyPreset,
    toggleRecord,
    exportData,
    ppRef,
  } = useSimulation()

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>Modelo de Hodgkin–Huxley · 1952</div>
          <h1 className={styles.title}>Potencial de acción de una neurona</h1>
        </div>
        <div className={styles.chips}>
          <Chip label="Vₘ" value={`${readout.V.toFixed(1)} mV`} color={C.vm} />
          <Chip label="disparos" value={readout.spikes} color={C.ink} />
        </div>
      </header>

      <main className={styles.grid}>
        <section className={styles.scopes} aria-label="Osciloscopios y gráficas">
          <Scope ref={vmRef} legend={[{ c: C.vm, t: 'Vₘ' }]} label="Potencial de membrana" />
          <Scope
            ref={iRef}
            legend={[
              { c: C.na, t: 'I_Na' },
              { c: C.k, t: 'I_K' },
              { c: C.leak, t: 'I_fuga' },
            ]}
            label="Corrientes iónicas"
          />
          <Scope
            ref={gRef}
            legend={[
              { c: C.na, t: 'm (act. Na)' },
              { c: C.hGate, t: 'h (inact. Na)' },
              { c: C.k, t: 'n (act. K)' },
            ]}
            label="Compuertas de activación"
          />
          <PhasePlane ref={ppRef} />
          <SteadyState />
          <IFCurve
            params={{
              gNa: control.gNa,
              gK: control.gK,
              gL: control.gL,
              temp: control.temp,
              iStim: control.iStim,
            }}
          />
        </section>

        <div className={styles.side}>
          <Controls
            control={control}
            running={running}
            recording={recording}
            phi={phi}
            presets={PRESETS}
            onPatch={patchControl}
            onToggleRun={toggleRun}
            onReset={reset}
            onFirePulse={firePulse}
            onPreset={applyPreset}
            onToggleRecord={toggleRecord}
            onExportCsv={exportData}
          />
          <Readouts readout={readout} />
        </div>
      </main>

      <footer className={styles.footer}>
        Cₘ·dVₘ/dt = I − ḡNa·m³h·(Vₘ−E_Na) − ḡK·n⁴·(Vₘ−E_K) − ḡfuga·(Vₘ−E_fuga)
        &nbsp;·&nbsp; E_Na {ENa} · E_K {EK} · E_fuga {EL} mV · ventana {WINDOW_MS} ms
      </footer>
    </div>
  )
}
