/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

export {}

declare global {
  /** Flush pending requestAnimationFrame callbacks queued in tests. */
  function flushRaf(): void
}
