import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSimulation } from './useSimulation'
import { DEFAULT_CONTROL } from '../sim/presets'
import { phiFor, PULSE_AMP } from '../sim/hh'

// exportData delegates to exportCsv; mock it so we can assert what it exports
// without touching Blob/URL/anchor plumbing (covered by exportCsv.test.ts).
const exportCsvMock = vi.fn()
vi.mock('../lib/exportCsv', () => ({
  exportCsv: (...args: unknown[]) => exportCsvMock(...args),
}))

const STORAGE_KEY = 'hh-sim.control.v1'

/** Run n animation frames inside act(); each flush runs the loop + requeues. */
function advanceFrames(n: number): void {
  act(() => {
    for (let i = 0; i < n; i++) flushRaf()
  })
}

describe('useSimulation', () => {
  beforeEach(() => {
    localStorage.clear()
    exportCsvMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mounts running, at rest, with phi for the default temperature', () => {
    const { result } = renderHook(() => useSimulation())
    expect(result.current.running).toBe(true)
    expect(result.current.recording).toBe(false)
    expect(result.current.control).toEqual(DEFAULT_CONTROL)
    expect(result.current.readout.spikes).toBe(0)
    expect(result.current.phi).toBeCloseTo(phiFor(DEFAULT_CONTROL.temp), 6)
  })

  it('persists control changes to localStorage and reflects patches', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.patchControl({ iStim: 12, gNa: 90 }))

    expect(result.current.control.iStim).toBe(12)
    expect(result.current.control.gNa).toBe(90)
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved.iStim).toBe(12)
    expect(saved.gNa).toBe(90)
  })

  it('restores persisted control on mount and falls back on corrupt data', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ iStim: 7 }))
    const { result: ok } = renderHook(() => useSimulation())
    expect(ok.current.control.iStim).toBe(7)
    expect(ok.current.control.gNa).toBe(DEFAULT_CONTROL.gNa) // merged with defaults

    localStorage.setItem(STORAGE_KEY, '{not json')
    const { result: bad } = renderHook(() => useSimulation())
    expect(bad.current.control).toEqual(DEFAULT_CONTROL)
  })

  it('advances the simulation and updates the readout while running', () => {
    const { result } = renderHook(() => useSimulation())
    const v0 = result.current.readout.V
    act(() => result.current.patchControl({ iStim: 20 }))
    advanceFrames(10) // 10 frames → readout refreshes on the 5th
    expect(result.current.readout.V).not.toBe(v0)
  })

  it('does not advance while paused', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.patchControl({ iStim: 20 }))
    act(() => result.current.toggleRun())
    expect(result.current.running).toBe(false)

    advanceFrames(10)
    expect(result.current.readout.V).toBe(-65) // never left rest
    expect(result.current.readout.spikes).toBe(0)
  })

  it('fires a manual pulse that drives at least one spike', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.firePulse())
    advanceFrames(60) // ~36 ms simulated — enough for a spike to peak
    expect(result.current.readout.spikes).toBeGreaterThanOrEqual(1)
  })

  it('reset returns the simulation to rest and clears the spike count', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.firePulse())
    advanceFrames(60)
    expect(result.current.readout.spikes).toBeGreaterThanOrEqual(1)

    act(() => result.current.reset())
    expect(result.current.readout.spikes).toBe(0)
    expect(result.current.readout.V).toBe(-65)
  })

  it('applyPreset sets parameters and resumes running; unknown key is a no-op', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.toggleRun()) // pause first
    act(() => result.current.applyPreset('block'))

    expect(result.current.running).toBe(true)
    expect(result.current.control.gNa).toBe(30)
    expect(result.current.control.iStim).toBe(12)

    const before = result.current.control
    act(() => result.current.applyPreset('does-not-exist'))
    expect(result.current.control).toEqual(before)
  })

  it('applyPreset with a pulse schedules the kick after a short delay', () => {
    // Only fake setTimeout: the default fake-timers config also hijacks
    // requestAnimationFrame, which would shadow the rAF polyfill in setup.ts
    // and leave flushRaf with nothing to flush.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.applyPreset('single'))
    expect(result.current.control).toMatchObject({ gNa: DEFAULT_CONTROL.gNa })

    act(() => {
      vi.advanceTimersByTime(80) // fire the scheduled pulse kick
    })
    advanceFrames(60)
    expect(result.current.readout.spikes).toBeGreaterThanOrEqual(1)
  })

  it('exportData exports the visible window by default and the recording when active', () => {
    const { result } = renderHook(() => useSimulation())

    // no recording: exports the 50 ms ring buffer (500 samples)
    advanceFrames(5)
    act(() => result.current.exportData())
    expect(exportCsvMock).toHaveBeenCalledTimes(1)
    expect(exportCsvMock.mock.calls[0][0].length).toBeGreaterThan(0)

    // recording on: accumulates beyond the window
    act(() => result.current.toggleRecord())
    expect(result.current.recording).toBe(true)
    act(() => result.current.patchControl({ iStim: 20 }))
    advanceFrames(20)
    act(() => result.current.exportData())
    const recorded = exportCsvMock.mock.calls[1][0]
    expect(recorded.length).toBe(20 * 6) // SAMPLES_PER_FRAME per frame
  })

  it('toggleRecord starts a fresh buffer each time it is enabled', () => {
    const { result } = renderHook(() => useSimulation())
    act(() => result.current.toggleRecord())
    advanceFrames(10)
    act(() => result.current.toggleRecord()) // stop
    act(() => result.current.toggleRecord()) // restart → fresh buffer
    advanceFrames(5)
    act(() => result.current.exportData())
    expect(exportCsvMock.mock.calls[0][0].length).toBe(5 * 6)
  })

  it('runs train and ramp stimulus protocols without throwing', () => {
    const { result } = renderHook(() => useSimulation())
    for (const protocol of ['train', 'ramp'] as const) {
      act(() => result.current.patchControl({ protocol, iStim: 15 }))
      expect(() => advanceFrames(30)).not.toThrow()
    }
    expect(PULSE_AMP).toBeGreaterThan(0)
  })
})
