import { describe, it, expect } from 'vitest'

describe('test harness smoke', () => {
  it('runs vitest with jsdom + raf flush helper', () => {
    let ran = false
    requestAnimationFrame(() => {
      ran = true
    })
    flushRaf()
    expect(ran).toBe(true)
    expect(document.createElement('canvas').getContext('2d')).not.toBeNull()
  })
})
