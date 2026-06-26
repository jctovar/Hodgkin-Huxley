import { C } from '../styles/theme'
import type { Readout } from '../sim/types'
import styles from './Readouts.module.css'

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export interface ReadoutsProps {
  readout: Readout
}

export function Readouts({ readout }: ReadoutsProps) {
  return (
    <div className={styles.readBox}>
      <div className={styles.readRow}>
        <span style={{ color: C.vm }}>Vₘ</span>
        <span className={styles.readVal}>{readout.V.toFixed(1)} mV</span>
      </div>
      <div className={styles.readRow}>
        <span style={{ color: C.na }}>I_Na</span>
        <span className={styles.readVal}>{readout.iNa.toFixed(0)} µA/cm²</span>
      </div>
      <div className={styles.readRow}>
        <span style={{ color: C.k }}>I_K</span>
        <span className={styles.readVal}>{readout.iK.toFixed(0)} µA/cm²</span>
      </div>
      <div className={styles.gateBars}>
        <GateBar label="m" v={readout.m} c={C.na} />
        <GateBar label="h" v={readout.h} c={C.hGate} />
        <GateBar label="n" v={readout.n} c={C.k} />
      </div>
    </div>
  )
}

interface GateBarProps {
  label: string
  v: number
  c: string
}

function GateBar({ label, v, c }: GateBarProps) {
  return (
    <div className={styles.gateCol}>
      <div className={styles.gateTop}>
        <span style={{ color: c }}>{label}</span>
        <span className={styles.gateNum}>{v.toFixed(2)}</span>
      </div>
      <div className={styles.gateTrack}>
        <div
          className={styles.gateFill}
          style={{ width: `${clamp01(v) * 100}%`, background: c }}
        />
      </div>
    </div>
  )
}
