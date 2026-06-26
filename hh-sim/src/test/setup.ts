import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom does not implement <canvas> 2D context. Provide a chainable stub so
// imperative drawing code (Scope/PhasePlane) runs under test without throwing.
// node-canvas (`canvas`) is installed for richer needs; this stub is enough for
// component smoke/render tests.
function makeCtxStub() {
  const noop = () => {}
  const ctx: Record<string, unknown> = {
    canvas: null,
    setTransform: noop,
    resetTransform: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    scale: noop,
    translate: noop,
    rotate: noop,
    setLineDash: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 0 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    drawImage: noop,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  }
  return ctx as unknown as CanvasRenderingContext2D
}

HTMLCanvasElement.prototype.getContext = (() => {
  return makeCtxStub()
}) as unknown as HTMLCanvasElement['getContext']

// jsdom returns 0 for layout sizes; give canvases a sensible default so drawing
// math doesn't collapse to zero-width plots.
if (!Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'clientWidth')) {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 600
    },
  })
}
if (!Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'clientHeight')) {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return 176
    },
  })
}

// requestAnimationFrame is used by the simulation loop; polyfill with a noop
// auto-cancelling rAF so the hook can mount in tests without driving frames.
let rafId = 0
const rafQueue = new Map<number, FrameRequestCallback>()
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
  const id = ++rafId
  rafQueue.set(id, cb)
  return id
}) as typeof requestAnimationFrame
globalThis.cancelAnimationFrame = ((id: number) => {
  rafQueue.delete(id)
}) as typeof cancelAnimationFrame
vi.stubGlobal('flushRaf', () => {
  const cbs = [...rafQueue.values()]
  rafQueue.clear()
  cbs.forEach((cb) => cb(performance.now()))
})
