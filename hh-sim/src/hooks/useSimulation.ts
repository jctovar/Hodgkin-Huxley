import { useCallback, useEffect, useRef, useState } from 'react'
import {
  C,
} from '../styles/theme'
import {
  PULSE_AMP,
  PULSE_MS,
  RAMP_PERIOD,
  SAMPLE_DT,
  SAMPLES_PER_FRAME,
  SPIKE_REARM,
  SPIKE_THRESHOLD,
  TRAIN_DUTY,
  TRAIN_PERIOD,
  currents,
  phiFor,
  restingState,
} from '../sim/hh'
import { INTEGRATORS } from '../sim/integrators'
import {
  DEFAULT_CONTROL,
  PRESETS,
  type ControlState,
} from '../sim/presets'
import type { HHParams, Readout, Sample } from '../sim/types'
import { currentRange } from '../lib/scopeDraw'
import { exportCsv } from '../lib/exportCsv'
import type { ScopeHandle } from '../components/Scope'
import type { PhasePlaneHandle } from '../components/PhasePlane'

interface Buffer {
  t: number[]
  V: number[]
  m: number[]
  h: number[]
  n: number[]
  iNa: number[]
  iK: number[]
  iL: number[]
}

function paramsFrom(c: ControlState): HHParams {
  return { gNa: c.gNa, gK: c.gK, gL: c.gL, temp: c.temp, iStim: c.iStim }
}

const STORAGE_KEY = 'hh-sim.control.v1'

function loadControl(): ControlState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CONTROL
    const parsed = JSON.parse(raw) as Partial<ControlState>
    return { ...DEFAULT_CONTROL, ...parsed }
  } catch {
    return DEFAULT_CONTROL
  }
}

/** External current for a frame, combining the protocol with a manual pulse. */
function stimulus(c: ControlState, t: number, pulseRemaining: number): number {
  const pulseKick = pulseRemaining > 0 ? PULSE_AMP : 0
  switch (c.protocol) {
    case 'train':
      return c.iStim + (t % TRAIN_PERIOD < TRAIN_DUTY ? PULSE_AMP : 0) + pulseKick
    case 'ramp':
      // triangular ramp 0 → iStim over RAMP_PERIOD (iStim = peak)
      return c.iStim * ((t % RAMP_PERIOD) / RAMP_PERIOD) + pulseKick
    case 'step':
    default:
      return c.iStim + pulseKick
  }
}

function createBuffer(): Buffer {
  const s = restingState()
  const len = Math.round(50 / SAMPLE_DT) // MAX_PTS, kept local to avoid a cycle
  return {
    t: Array.from({ length: len }, (_, i) => i * SAMPLE_DT),
    V: new Array(len).fill(s.V),
    m: new Array(len).fill(s.m),
    h: new Array(len).fill(s.h),
    n: new Array(len).fill(s.n),
    iNa: new Array(len).fill(0),
    iK: new Array(len).fill(0),
    iL: new Array(len).fill(0),
  }
}

/** Scroll a ring buffer: append the newest sample, drop the oldest. */
function scroll(b: Buffer, s: {
  t: number
  V: number
  m: number
  h: number
  n: number
  iNa: number
  iK: number
  iL: number
}): void {
  for (const key of Object.keys(b) as (keyof Buffer)[]) {
    const arr = b[key]
    arr.push(s[key])
    arr.shift()
  }
}

/** Snapshot the visible window as Sample[] (oldest → newest). */
function bufferToSamples(b: Buffer): Sample[] {
  const out: Sample[] = new Array(b.V.length)
  for (let i = 0; i < b.V.length; i++) {
    out[i] = {
      t: b.t[i],
      V: b.V[i],
      m: b.m[i],
      h: b.h[i],
      n: b.n[i],
      iNa: b.iNa[i],
      iK: b.iK[i],
      iL: b.iL[i],
    }
  }
  return out
}

const REST_READOUT: Readout = { V: -65, m: 0, h: 0, n: 0, iNa: 0, iK: 0, iL: 0, spikes: 0 }

export interface UseSimulation {
  control: ControlState
  running: boolean
  readout: Readout
  phi: number
  recording: boolean
  vmRef: React.RefObject<ScopeHandle | null>
  iRef: React.RefObject<ScopeHandle | null>
  gRef: React.RefObject<ScopeHandle | null>
  ppRef: React.RefObject<PhasePlaneHandle | null>
  patchControl: (patch: Partial<ControlState>) => void
  toggleRun: () => void
  reset: () => void
  firePulse: () => void
  applyPreset: (key: string) => void
  toggleRecord: () => void
  exportData: () => void
}

export function useSimulation(): UseSimulation {
  const [control, setControl] = useState<ControlState>(loadControl)
  const [running, setRunning] = useState(true)
  const [readout, setReadout] = useState<Readout>(REST_READOUT)
  const [recording, setRecording] = useState(false)

  // persist control params across reloads (DEVELOPMENT.md §4.4)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(control))
    } catch {
      /* storage unavailable — ignore */
    }
  }, [control])

  // mirror live control values into a ref the animation loop reads each frame,
  // so the loop never depends on React re-renders (legacy constraint). Synced in
  // an effect (writing refs during render is forbidden by react-hooks/refs).
  const ctrlRef = useRef({ ...control, running })
  useEffect(() => {
    ctrlRef.current = { ...control, running }
  })

  const simRef = useRef(restingState())
  const pulseRef = useRef(0)
  const spikesRef = useRef(0)
  const aboveZeroRef = useRef(false)
  const tNowRef = useRef(0)
  const bufRef = useRef<Buffer | null>(null)
  if (bufRef.current === null) bufRef.current = createBuffer()

  const vmRef = useRef<ScopeHandle | null>(null)
  const iRef = useRef<ScopeHandle | null>(null)
  const gRef = useRef<ScopeHandle | null>(null)
  const ppRef = useRef<PhasePlaneHandle | null>(null)

  // recording buffer for CSV export (grows beyond the 50 ms window)
  const recRef = useRef<Sample[]>([])
  const recordingRef = useRef(false)

  const reset = useCallback(() => {
    simRef.current = restingState()
    pulseRef.current = 0
    spikesRef.current = 0
    aboveZeroRef.current = false
    tNowRef.current = 0
    bufRef.current = createBuffer()
    recRef.current = []
    setReadout(REST_READOUT)
  }, [])

  const firePulse = useCallback(() => {
    pulseRef.current = PULSE_MS
  }, [])

  const patchControl = useCallback((patch: Partial<ControlState>) => {
    setControl((c) => ({ ...c, ...patch }))
  }, [])

  const toggleRun = useCallback(() => setRunning((r) => !r), [])

  const toggleRecord = useCallback(() => {
    setRecording((on) => {
      const next = !on
      recordingRef.current = next
      if (next) recRef.current = [] // start a fresh recording
      return next
    })
  }, [])

  const exportData = useCallback(() => {
    const data =
      recRef.current.length > 0 ? recRef.current : bufferToSamples(bufRef.current!)
    exportCsv(data)
  }, [])

  const applyPreset = useCallback(
    (key: string) => {
      const p = PRESETS[key]
      if (!p) return
      const { label: _label, pulse, ...rest } = p
      void _label
      setControl({ ...DEFAULT_CONTROL, ...rest })
      setRunning(true)
      if (pulse) {
        reset()
        setTimeout(() => {
          pulseRef.current = PULSE_MS
        }, 60)
      }
    },
    [reset],
  )

  useEffect(() => {
    let raf = 0
    let frame = 0

    const advance = () => {
      const ctrl = ctrlRef.current
      if (!ctrl.running) return
      const phi = phiFor(ctrl.temp)
      const integ = INTEGRATORS[ctrl.method]
      const dt = ctrl.dt
      const stepsPerSample = Math.max(1, Math.round(SAMPLE_DT / dt))
      const params = paramsFrom(ctrl)
      const b = bufRef.current!
      let s = simRef.current

      for (let k = 0; k < SAMPLES_PER_FRAME; k++) {
        for (let j = 0; j < stepsPerSample; j++) {
          const iExt = stimulus(ctrl, tNowRef.current, pulseRef.current)
          if (pulseRef.current > 0) pulseRef.current -= dt
          s = integ(s, params, phi, iExt, dt)
          if (!aboveZeroRef.current && s.V >= SPIKE_THRESHOLD) {
            spikesRef.current++
            aboveZeroRef.current = true
          } else if (aboveZeroRef.current && s.V < SPIKE_REARM) {
            aboveZeroRef.current = false
          }
        }
        tNowRef.current += SAMPLE_DT
        const c = currents(s, params)
        const sample = {
          t: tNowRef.current,
          V: s.V,
          m: s.m,
          h: s.h,
          n: s.n,
          iNa: c.iNa,
          iK: c.iK,
          iL: c.iL,
        }
        scroll(b, sample)
        if (recordingRef.current) recRef.current.push(sample)
      }
      simRef.current = s
    }

    const draw = () => {
      const b = bufRef.current!
      vmRef.current?.draw(
        [{ data: b.V, color: C.vm, glow: true, w: 2 }],
        [-90, 55],
        {
          zero: 0,
          marks: [
            { y: 0, label: '0', c: C.muted },
            { y: -55, label: 'umbral', c: 'rgba(255,209,102,0.35)', dash: true },
          ],
          unit: 'mV',
          title: 'Potencial de membrana  Vₘ',
        },
      )
      const range = currentRange(b.iNa, b.iK, b.iL)
      iRef.current?.draw(
        [
          { data: b.iNa, color: C.na, w: 1.8 },
          { data: b.iK, color: C.k, w: 1.8 },
          { data: b.iL, color: C.leak, w: 1.4 },
        ],
        range,
        { zero: 0, unit: 'µA/cm²', title: 'Corrientes iónicas' },
      )
      gRef.current?.draw(
        [
          { data: b.m, color: C.na, w: 1.8 },
          { data: b.h, color: C.hGate, w: 1.8 },
          { data: b.n, color: C.k, w: 1.8 },
        ],
        [0, 1],
        { unit: '', title: 'Compuertas  m · h · n' },
      )
      ppRef.current?.draw(b.V, b.n)
    }

    const loop = () => {
      advance()
      draw()
      frame++
      if (frame % 5 === 0) {
        const s = simRef.current
        const c = currents(s, paramsFrom(ctrlRef.current))
        setReadout({
          V: s.V,
          m: s.m,
          h: s.h,
          n: s.n,
          iNa: c.iNa,
          iK: c.iK,
          iL: c.iL,
          spikes: spikesRef.current,
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return {
    control,
    running,
    readout,
    phi: phiFor(control.temp),
    recording,
    vmRef,
    iRef,
    gRef,
    ppRef,
    patchControl,
    toggleRun,
    reset,
    firePulse,
    applyPreset,
    toggleRecord,
    exportData,
  }
}
